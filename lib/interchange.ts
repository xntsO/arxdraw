import { createBlankProject, uid } from './model.ts';
import type { Classifier, Project, Relationship } from './model.ts';

// Supported PlantUML subset: class/interface/abstract class declarations, member
// bodies (or Alias : member), six UML links, multiplicities, title and one-line
// notes. Packages, macros, includes, stereotypes and other diagram types are
// rejected deliberately; importing them must never silently discard a model.
const links: Record<Relationship['kind'], string> = {
  association: '--',
  aggregation: 'o--',
  composition: '*--',
  inheritance: '--|>',
  dependency: '..>',
  realization: '..|>',
};
const textEncode = (value: string) =>
  value.replace(
    /[<>"\\{}\r\n]/g,
    (char) =>
      `<U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}>`,
  );
const textDecode = (value: string) =>
  value.replace(/<U\+([0-9a-f]{4,6})>/gi, (_, hex: string) => {
    const point = Number.parseInt(hex, 16);
    if (point > 0x10ffff) throw new Error('Invalid Unicode escape.');
    return String.fromCodePoint(point);
  });
const quoted = (value: string) => `"${textEncode(value)}"`;
const unquote = (value: string) =>
  textDecode(
    value.startsWith('"')
      ? value.slice(1, -1).replace(/\\(["\\])/g, '$1')
      : value,
  );

export function exportClassPlantUml(
  project: Project,
  diagramId?: string,
): string {
  const diagram = diagramId
    ? project.diagrams.find((d) => d.id === diagramId)
    : undefined;
  if (diagramId && !diagram) throw new Error('Diagram not found.');
  const classes = diagram
    ? project.classes.filter((c) => diagram.classIds.includes(c.id))
    : project.classes;
  const aliases = new Map(classes.map((c, i) => [c.id, `C${i + 1}`]));
  const output = [
    '@startuml',
    `title ${textEncode(diagram?.name || project.name || 'Class diagram')}`,
    '',
  ];
  for (const c of classes) {
    output.push(
      `${c.kind === 'abstract' ? 'abstract class' : c.kind} ${quoted(c.name)} as ${aliases.get(c.id)} {`,
    );
    if (c.attributes)
      for (const line of c.attributes.split('\n'))
        output.push(`  {field} ${textEncode(line)}`);
    if (c.operations)
      for (const line of c.operations.split('\n'))
        output.push(`  {method} ${textEncode(line)}`);
    output.push('}');
    if (c.description)
      output.push(
        `note right of ${aliases.get(c.id)} : ${textEncode(c.description)}`,
      );
    output.push('');
  }
  for (const r of project.relationships) {
    if (diagram && !diagram.relationshipIds.includes(r.id)) continue;
    const from = aliases.get(r.from),
      to = aliases.get(r.to);
    if (!from || !to) continue;
    output.push(
      `${from}${r.sourceMultiplicity ? ` ${quoted(r.sourceMultiplicity)}` : ''} ${links[r.kind]}${r.targetMultiplicity ? ` ${quoted(r.targetMultiplicity)}` : ''} ${to}${r.label ? ` : ${textEncode(r.label)}` : ''}`,
    );
  }
  return [...output, '@enduml', ''].join('\n');
}

export function importClassPlantUml(source: string): Project {
  if (source.length > 1_000_000)
    throw new Error('PlantUML source exceeds 1 MB.');
  const project = createBlankProject();
  project.name = 'Imported classes';
  project.diagrams[0].name = 'Class diagram';
  const aliases = new Map<string, Classifier>();
  const pending: {
    from: string;
    to: string;
    kind: Relationship['kind'];
    label: string;
    sourceMultiplicity: string;
    targetMultiplicity: string;
    line: number;
  }[] = [];
  const notes: { alias: string; text: string; line: number }[] = [];
  const token = '(?:"(?:[^"\\\\]|\\\\.)*"|[\\p{L}_$][\\p{L}\\p{N}_$.]*)';
  const declaration = new RegExp(
    `^(abstract\\s+class|abstract|class|interface)\\s+(${token})(?:\\s+as\\s+([\\p{L}_$][\\p{L}\\p{N}_$]*))?\\s*(\\{)?$`,
    'u',
  );
  const relation = new RegExp(
    `^(${token})(?:\\s+("(?:[^"\\\\]|\\\\.)*"))?\\s+(--\\|>|\\.\\.\\|>|<\\|--|<\\|\\.\\.|o--|--o|\\*--|--\\*|\\.\\.>|<\\.\\.|-->|<--|--)(?:\\s+("(?:[^"\\\\]|\\\\.)*"))?\\s+(${token})(?:\\s*:\\s*(.*))?$`,
    'u',
  );
  const externalMember = new RegExp(`^(${token})\\s*:\\s*(.+)$`, 'u');
  let active: Classifier | undefined;
  let started = false,
    ended = false;
  const fail = (line: number, message: string): never => {
    throw new Error(`Line ${line}: ${message}`);
  };
  const addMember = (c: Classifier, raw: string) => {
    const explicit = raw.match(/^\{(field|method)\}\s?(.*)$/);
    const member = textDecode(explicit ? explicit[2] : raw);
    const key = explicit
      ? explicit[1] === 'field'
        ? 'attributes'
        : 'operations'
      : member.includes('(')
        ? 'operations'
        : 'attributes';
    c[key] += `${c[key] ? '\n' : ''}${member}`;
  };
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = index + 1,
      value = lines[index].trim();
    if (!value || value.startsWith("'")) continue;
    if (ended) fail(line, 'Unexpected content after @enduml.');
    if (active) {
      if (value === '}') {
        active = undefined;
        continue;
      }
      if (
        /^[@!]|^(?:class|interface|abstract|package|note)\s/.test(value) ||
        value.includes('}')
      ) {
        // Explicit {field}/{method} markers and {static}/{abstract} modifiers are members.
        if (!/^\{(?:field|method|static|abstract)\}/.test(value))
          fail(line, 'Unsupported member syntax or missing closing brace.');
      }
      if (/^(?:--+|\.\.+|==+|__+)$/.test(value)) continue;
      addMember(active, value);
      continue;
    }
    if (value === '@startuml') {
      if (started || project.classes.length)
        fail(line, 'Unexpected @startuml.');
      started = true;
      continue;
    }
    if (value === '@enduml') {
      ended = true;
      continue;
    }
    const title = value.match(/^title\s+(.+)$/);
    if (title) {
      project.name = textDecode(title[1]);
      project.diagrams[0].name = project.name;
      continue;
    }
    const decl = value.match(declaration);
    if (decl) {
      const name = unquote(decl[2]),
        alias = decl[3] ?? name;
      if (aliases.has(alias)) fail(line, `Duplicate class alias: ${alias}.`);
      if (project.classes.length >= 2000)
        fail(line, 'Maximum of 2000 classes exceeded.');
      const c: Classifier = {
        id: uid(),
        name,
        kind: decl[1].startsWith('abstract')
          ? 'abstract'
          : (decl[1] as Classifier['kind']),
        attributes: '',
        operations: '',
        description: '',
      };
      project.classes.push(c);
      aliases.set(alias, c);
      if (decl[4]) active = c;
      continue;
    }
    const rel = value.match(relation);
    if (rel) {
      let from = unquote(rel[1]),
        to = unquote(rel[5]);
      let sourceMultiplicity = rel[2] ? unquote(rel[2]) : '',
        targetMultiplicity = rel[4] ? unquote(rel[4]) : '';
      const arrow = rel[3];
      const reverse = ['<|--', '<|..', '--o', '--*', '<..', '<--'].includes(
        arrow,
      );
      if (reverse) {
        [from, to] = [to, from];
        [sourceMultiplicity, targetMultiplicity] = [
          targetMultiplicity,
          sourceMultiplicity,
        ];
      }
      const kind: Relationship['kind'] = arrow.includes('|')
        ? arrow.includes('.')
          ? 'realization'
          : 'inheritance'
        : arrow.includes('*')
          ? 'composition'
          : arrow.includes('o')
            ? 'aggregation'
            : arrow.includes('.')
              ? 'dependency'
              : 'association';
      pending.push({
        from,
        to,
        kind,
        sourceMultiplicity,
        targetMultiplicity,
        label: textDecode(rel[6] ?? ''),
        line,
      });
      continue;
    }
    const note = value.match(
      /^note\s+(?:left|right|top|bottom)\s+of\s+(\S+)\s*:\s*(.*)$/,
    );
    if (note) {
      notes.push({ alias: note[1], text: textDecode(note[2]), line });
      continue;
    }
    const member = value.match(externalMember);
    if (member) {
      const c = aliases.get(unquote(member[1]));
      if (!c) fail(line, `Declare ${member[1]} before adding its members.`);
      addMember(c!, member[2]);
      continue;
    }
    fail(
      line,
      'Unsupported PlantUML syntax. Use class/interface declarations, members and class relationships.',
    );
  }
  if (active) fail(lines.length, `Missing closing brace for ${active.name}.`);
  if (started && !ended) fail(lines.length, 'Missing @enduml.');
  for (const r of pending) {
    const from = aliases.get(r.from),
      to = aliases.get(r.to);
    if (!from || !to)
      fail(
        r.line,
        `Relationship refers to an undeclared class: ${!from ? r.from : r.to}.`,
      );
    project.relationships.push({
      id: uid(),
      from: from!.id,
      to: to!.id,
      kind: r.kind,
      label: r.label,
      sourceMultiplicity: r.sourceMultiplicity,
      targetMultiplicity: r.targetMultiplicity,
    });
  }
  for (const note of notes) {
    const c = aliases.get(note.alias);
    if (!c)
      fail(note.line, `Note refers to an undeclared class: ${note.alias}.`);
    c!.description += `${c!.description ? '\n' : ''}${note.text}`;
  }
  project.diagrams[0].classIds = project.classes.map((c) => c.id);
  project.diagrams[0].relationshipIds = project.relationships.map((r) => r.id);
  return project;
}

const javaKeywords = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _'.split(
    ' ',
  ),
);
const javaIdentifier = (value: string) => {
  const normalized = value.trim().replace(/[^\p{L}\p{N}_$]/gu, '_');
  const name = /^[\p{L}_$]/u.test(normalized) ? normalized : `_${normalized}`;
  return javaKeywords.has(name) ? `${name}_` : name || 'Unnamed';
};
const visibility = (symbol: string | undefined) =>
  symbol === '-'
    ? 'private '
    : symbol === '#'
      ? 'protected '
      : symbol === '~'
        ? ''
        : 'public ';
const splitTypes = (value: string) => {
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '<') depth++;
    if (value[i] === '>') depth--;
    if (value[i] === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error(`Unbalanced generic type: ${value}`);
  if (value.slice(start).trim()) parts.push(value.slice(start).trim());
  return parts;
};
type JavaMethod = {
  name: string;
  returnType: string;
  args: string[];
  argTypes: string[];
  access: string;
  static: boolean;
  abstract: boolean;
  constructor: boolean;
};

/** Generate compilable Java skeletons. Unknown external UML types become Object. */
export function generateJava(
  project: Project,
): { name: string; source: string }[] {
  const names = new Map<string, string>(),
    classNames = new Map<string, string>(),
    used = new Set<string>();
  for (const c of project.classes) {
    if (classNames.has(c.name))
      throw new Error(
        `Duplicate class name: ${c.name}. Rename it before generating Java.`,
      );
    const base = javaIdentifier(c.name);
    let name = base,
      suffix = 2;
    while (used.has(name)) name = `${base}${suffix++}`;
    used.add(name);
    names.set(c.id, name);
    classNames.set(c.name, name);
  }
  const type = (raw: string, boxed = false): string => {
    const value = raw.trim().replace(/\?$/, '') || 'Object';
    if (value.endsWith('[]')) {
      const itemType = type(value.slice(0, -2));
      if (itemType === 'void')
        throw new Error('An array cannot have element type void.');
      return `${itemType}[]`;
    }
    if (classNames.has(value)) return classNames.get(value)!;
    const generic = value.match(/^([\w.]+)\s*<(.+)>$/);
    if (generic) {
      const containers: Record<string, string> = {
        List: 'java.util.List',
        Set: 'java.util.Set',
        Collection: 'java.util.Collection',
        Map: 'java.util.Map',
        Optional: 'java.util.Optional',
      };
      const container = containers[generic[1]];
      if (!container) return 'Object';
      const args = splitTypes(generic[2]);
      if (args.length !== (generic[1] === 'Map' ? 2 : 1))
        throw new Error(`Invalid type argument count: ${value}.`);
      return `${container}<${args.map((a) => type(a, true)).join(', ')}>`;
    }
    const common: Record<string, string> = {
      String: 'String',
      string: 'String',
      Integer: 'int',
      integer: 'int',
      int: 'int',
      Boolean: 'boolean',
      boolean: 'boolean',
      Float: 'float',
      float: 'float',
      Double: 'double',
      double: 'double',
      Real: 'double',
      real: 'double',
      Number: 'double',
      Long: 'long',
      long: 'long',
      Short: 'short',
      short: 'short',
      Byte: 'byte',
      byte: 'byte',
      Character: 'char',
      char: 'char',
      void: 'void',
      Void: 'void',
      UUID: 'java.util.UUID',
      Date: 'java.time.LocalDate',
      DateTime: 'java.time.LocalDateTime',
      Money: 'java.math.BigDecimal',
      Object: 'Object',
      List: 'java.util.List<Object>',
      Set: 'java.util.Set<Object>',
      Map: 'java.util.Map<Object, Object>',
    };
    const mapped = common[value] ?? 'Object';
    const boxes: Record<string, string> = {
      int: 'Integer',
      boolean: 'Boolean',
      float: 'Float',
      double: 'Double',
      long: 'Long',
      short: 'Short',
      byte: 'Byte',
      char: 'Character',
      void: 'Void',
    };
    return boxed ? (boxes[mapped] ?? mapped) : mapped;
  };
  const methods = new Map<string, JavaMethod[]>();
  for (const c of project.classes) {
    methods.set(
      c.id,
      c.operations
        .split('\n')
        .filter((s) => s.trim())
        .map((raw) => {
          const isStatic = /\{static\}/.test(raw),
            isAbstract = /\{abstract\}/.test(raw);
          const line = raw.replace(/\{(?:static|abstract)\}/g, '').trim();
          const match = line.match(
            /^([+\-#~])?\s*([^():]+)\((.*)\)\s*(?::\s*(.+))?$/,
          );
          if (!match)
            throw new Error(
              `${c.name}: unsupported operation “${raw}”. Use + method(arg: Type): ReturnType.`,
            );
          const constructor = match[2].trim() === c.name && !match[4];
          const args = splitTypes(match[3]).map((arg) => {
            const parameter = arg.match(
              /^([\p{L}_$][\p{L}\p{N}_$]*)\s*:\s*(.+)$/u,
            );
            if (!parameter)
              throw new Error(
                `${c.name}: unsupported parameter “${arg}”. Use name: Type.`,
              );
            const parameterType = type(parameter[2]);
            if (parameterType === 'void')
              throw new Error(`${c.name}: a parameter cannot have type void.`);
            return { name: javaIdentifier(parameter[1]), type: parameterType };
          });
          if (new Set(args.map((a) => a.name)).size !== args.length)
            throw new Error(`${c.name}: duplicate parameter names in ${raw}.`);
          if (constructor && c.kind === 'interface')
            throw new Error(`${c.name}: interfaces cannot have constructors.`);
          if (isAbstract && (isStatic || match[1] === '-'))
            throw new Error(
              `${c.name}: abstract methods cannot be private or static.`,
            );
          if (isAbstract && c.kind === 'class')
            throw new Error(
              `${c.name}: change the class to abstract before generating an abstract method.`,
            );
          return {
            name: constructor ? names.get(c.id)! : javaIdentifier(match[2]),
            returnType: type(match[4] ?? 'void'),
            args: args.map((a) => `${a.type} ${a.name}`),
            argTypes: args.map((a) => a.type),
            access: visibility(match[1]),
            static: isStatic,
            abstract: isAbstract,
            constructor,
          };
        }),
    );
  }
  const erased = (value: string) => {
    let result = value;
    while (/<[^<>]*>/.test(result)) result = result.replace(/<[^<>]*>/g, '');
    return result;
  };
  const signature = (m: JavaMethod) =>
    `${m.name}(${m.argTypes.map(erased).join(',')})`;
  const parents = (c: Classifier) =>
    project.relationships
      .filter(
        (r) =>
          r.from === c.id &&
          (r.kind === 'inheritance' || r.kind === 'realization'),
      )
      .map((r) => {
        const target = project.classes.find((item) => item.id === r.to);
        if (!target) throw new Error(`${c.name}: missing inheritance target.`);
        if (r.kind === 'realization' && target.kind !== 'interface')
          throw new Error(`${c.name}: realization must target an interface.`);
        if (c.kind === 'interface' && target.kind !== 'interface')
          throw new Error(
            `${c.name}: an interface can only extend interfaces.`,
          );
        return target;
      });
  const required = (c: Classifier, path = new Set<string>()): JavaMethod[] => {
    if (path.has(c.id))
      throw new Error('Inheritance cycle: Java cannot be generated.');
    const next = new Set(path).add(c.id);
    return [
      ...(methods.get(c.id) ?? []).filter(
        (m) =>
          !m.constructor && !m.static && (c.kind === 'interface' || m.abstract),
      ),
      ...parents(c).flatMap((p) => required(p, next)),
    ];
  };
  return project.classes.map((c) => {
    const name = names.get(c.id)!,
      inherited = parents(c);
    required(c); // Validate cycles even for abstract-only models.
    const baseClasses = inherited.filter((p) => p.kind !== 'interface');
    const interfaces = [
      ...new Set(
        inherited
          .filter((p) => p.kind === 'interface')
          .map((p) => names.get(p.id)!),
      ),
    ];
    if (baseClasses.length > 1)
      throw new Error(`${c.name}: Java supports only one superclass.`);
    if (
      baseClasses.some((base) =>
        methods
          .get(base.id)
          ?.some(
            (m) => m.constructor && !m.args.length && m.access === 'private ',
          ),
      )
    ) {
      throw new Error(
        `${c.name}: its superclass has a private no-argument constructor.`,
      );
    }
    const extendsClause =
      c.kind === 'interface'
        ? interfaces.length
          ? ` extends ${interfaces.join(', ')}`
          : ''
        : baseClasses.length
          ? ` extends ${names.get(baseClasses[0].id)}`
          : '';
    const implementsClause =
      c.kind !== 'interface' && interfaces.length
        ? ` implements ${interfaces.join(', ')}`
        : '';
    const result = [
      '// Generated from ArxDraw. Unknown external UML types use Object.',
      `public ${c.kind === 'abstract' ? 'abstract class' : c.kind} ${name}${extendsClause}${implementsClause} {`,
    ];
    const fields = new Set<string>();
    const defaultValue = (t: string) =>
      t === 'boolean'
        ? 'false'
        : t === 'char'
          ? "'\\0'"
          : ['int', 'short', 'byte', 'long', 'float', 'double'].includes(t)
            ? '0'
            : 'null';
    for (const raw of c.attributes.split('\n').filter((s) => s.trim())) {
      const isStatic = /\{static\}/.test(raw);
      const match = raw
        .replace(/\{static\}/g, '')
        .trim()
        .match(/^([+\-#~])?\s*([^:=]+)\s*:\s*([^=]+)(?:=\s*(.*))?$/);
      if (!match)
        throw new Error(
          `${c.name}: unsupported attribute “${raw}”. Use - name: Type.`,
        );
      const fieldName = javaIdentifier(match[2]),
        fieldType = type(match[3]);
      if (fieldType === 'void')
        throw new Error(`${c.name}: a field cannot have type void.`);
      if (fields.has(fieldName))
        throw new Error(`${c.name}: duplicate field ${fieldName}.`);
      fields.add(fieldName);
      result.push(
        `    ${c.kind === 'interface' ? 'public static final ' : `${visibility(match[1])}${isStatic ? 'static ' : ''}`}${fieldType} ${fieldName}${c.kind === 'interface' ? ` = ${defaultValue(fieldType)}` : ''};`,
      );
    }
    const own = [...(methods.get(c.id) ?? [])],
      seen = new Set<string>();
    for (const m of own) {
      const key = signature(m);
      if (seen.has(key))
        throw new Error(`${c.name}: duplicate operation ${key}.`);
      seen.add(key);
    }
    if (c.kind === 'class') {
      for (const method of inherited.flatMap((p) => required(p))) {
        const existing = own.find((m) => signature(m) === signature(method));
        if (existing) {
          if (
            existing.static ||
            existing.returnType !== method.returnType ||
            existing.argTypes.join(',') !== method.argTypes.join(',')
          ) {
            throw new Error(
              `${c.name}: incompatible inherited operation ${method.name}.`,
            );
          }
          existing.access = 'public ';
          continue;
        }
        own.push({ ...method, access: 'public ', abstract: false });
      }
    }
    // A no-argument constructor lets generated subclasses compile even when a
    // UML superclass only declares constructors with parameters.
    if (
      c.kind !== 'interface' &&
      own.some((m) => m.constructor) &&
      !own.some((m) => m.constructor && !m.args.length)
    )
      result.push(`\n    protected ${name}() {}`);
    for (const m of own) {
      const declaration = `    ${c.kind === 'interface' ? 'public ' : m.access}${m.static ? 'static ' : ''}${m.abstract && c.kind !== 'interface' ? 'abstract ' : ''}${m.constructor ? '' : `${m.returnType} `}${m.name}(${m.args.join(', ')})`;
      if ((c.kind === 'interface' && !m.static) || m.abstract)
        result.push(`\n${declaration};`);
      else
        result.push(
          `\n${declaration} {`,
          ...(m.constructor
            ? []
            : [
                '        throw new UnsupportedOperationException("Not implemented");',
              ]),
          '    }',
        );
    }
    result.push('}', '');
    return { name: `${name}.java`, source: result.join('\n') };
  });
}
