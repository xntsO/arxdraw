import { createBlankProject, uid } from './model.ts';
import type { Classifier, Project, Relationship } from './model.ts';
import { parseMember } from './members.ts';
import { parseProject } from './project-parse.ts';
import {
  localName,
  parseXml,
  xmlAttribute as attr,
  xmlEscape as escape,
  xmlId,
} from './xml.ts';
import type { XmlNode } from './xml.ts';

export const xmiSubsetDescription =
  'Self-contained UML 2 XMI class-model subset: classes, abstract classes, interfaces, members, comments and six class relationship kinds. Imports reject packages, packageImport, external primitive-library references, named association roles and navigability. Selected-diagram export rejects member types that refer to classifiers outside that diagram. Layout, drawings, behavioral models and UML 1 / ArgoUML .zargo projects are not supported. ArxDraw annotations preserve notation only when it matches the UML members. External-tool compatibility is not certified.';
const children = (node: XmlNode, name: string) =>
  node.children.filter((child) => localName(child.name) === name);
const nodeType = (node: XmlNode) =>
  localName(attr(node, 'xmi:type') ?? node.name);
const visibility = (value: string | undefined) => {
  switch (value) {
    case '+':
      return 'public';
    case '-':
      return 'private';
    case '#':
      return 'protected';
    case '~':
      return 'package';
    default:
      return undefined;
  }
};
const symbol = (value: string | undefined) => {
  switch (value) {
    case 'public':
      return '+ ';
    case 'private':
      return '- ';
    case 'protected':
      return '# ';
    case 'package':
      return '~ ';
    case undefined:
      return '';
    default:
      throw new Error(`Unsupported XMI visibility: ${value}.`);
  }
};
const attributes = (values: Record<string, string | undefined>) =>
  Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escape(value ?? '')}"`)
    .join('');
const tag = (
  name: string,
  values: Record<string, string | undefined>,
  body: string[] = [],
) =>
  body.length
    ? `<${name}${attributes(values)}>\n${body.join('\n')}\n</${name}>`
    : `<${name}${attributes(values)}/>`;
function parameters(raw: string): { name: string; type: string }[] {
  if (!raw.trim()) return [];
  const parts: string[] = [];
  let depth = 0,
    start = 0;
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] === '<') depth++;
    else if (raw[index] === '>') depth--;
    else if (raw[index] === ',' && depth === 0) {
      parts.push(raw.slice(start, index));
      start = index + 1;
    }
    if (depth < 0)
      throw new Error('Unbalanced generic parameter type in XMI export.');
  }
  if (depth)
    throw new Error('Unbalanced generic parameter type in XMI export.');
  parts.push(raw.slice(start));
  return parts.map((part) => {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(.+?)\s*$/.exec(part);
    if (!match)
      throw new Error(
        `Unsupported XMI parameter "${part.trim()}". Use name: Type.`,
      );
    return { name: match[1], type: match[2] };
  });
}
function multiplicity(value: string, id: string): string[] {
  if (!value) return [];
  const match = /^(\d+|\*)(?:\.\.(\d+|\*))?$/.exec(value.trim());
  if (
    !match ||
    (match[2] &&
      (match[1] === '*' ||
        (match[2] !== '*' && Number(match[1]) > Number(match[2]))))
  )
    throw new Error(
      `Unsupported XMI multiplicity "${value}". Use an integer, *, or a single range.`,
    );
  return [
    tag('lowerValue', {
      'xmi:type': 'uml:LiteralInteger',
      'xmi:id': `${id}_lower`,
      value: match[1] === '*' ? '0' : match[1],
    }),
    tag('upperValue', {
      'xmi:type': 'uml:LiteralUnlimitedNatural',
      'xmi:id': `${id}_upper`,
      value: (match[2] ?? match[1]) === '*' ? '*' : (match[2] ?? match[1]),
    }),
  ];
}

export function exportClassXmi(project: Project, diagramId?: string): string {
  parseProject(JSON.stringify(project));
  const diagram = diagramId
    ? project.diagrams.find((item) => item.id === diagramId)
    : undefined;
  if (diagramId && !diagram) throw new Error('Diagram not found.');
  const classes = diagram
    ? project.classes.filter((item) => diagram.classIds.includes(item.id))
    : project.classes;
  const ids = new Map(classes.map((item, index) => [item.id, `c${index + 1}`]));
  const relationships = project.relationships.filter(
    (item) =>
      (!diagram || diagram.relationshipIds.includes(item.id)) &&
      ids.has(item.from) &&
      ids.has(item.to),
  );
  const relationIds = new Map(
    relationships.map((item, index) => [item.id, `r${index + 1}`]),
  );
  if (relationships.some((relationship) => relationship.navigable))
    throw new Error(
      'XMI association navigability export is not supported. Use PlantUML to preserve directed associations.',
    );
  const primitives = new Map<string, string>();
  const typeId = (type: string): string | undefined => {
    if (!type) return undefined;
    const matching = project.classes.filter((item) => item.name === type);
    if (matching.length > 1)
      throw new Error(
        `Ambiguous XMI classifier type: ${type}. Use unique classifier names.`,
      );
    if (matching.length === 1 && !ids.has(matching[0].id))
      throw new Error(
        `XMI type "${type}" refers to a classifier outside the selected diagram. Export the whole class model instead.`,
      );
    if (matching.length === 1) return ids.get(matching[0].id);
    let id = primitives.get(type);
    if (!id) {
      id = `t${primitives.size + 1}`;
      primitives.set(type, id);
    }
    return id;
  };
  const classifierNodes = classes.map((classifier) => {
    const id = ids.get(classifier.id) ?? '';
    const body: string[] = [];
    for (const [index, raw] of classifier.attributes.split('\n').entries()) {
      if (!raw.trim()) continue;
      const fields = parseMember(raw, 'attributes').fields;
      if (!fields)
        throw new Error(
          `${classifier.name}: unsupported XMI attribute "${raw}". Use - name: Type.`,
        );
      body.push(
        tag('ownedAttribute', {
          'xmi:id': `${id}_a${index}`,
          name: fields.name,
          visibility: visibility(fields.visibility),
          type: typeId(fields.type),
        }),
      );
    }
    for (const [index, raw] of classifier.operations.split('\n').entries()) {
      if (!raw.trim()) continue;
      const fields = parseMember(raw, 'operations').fields;
      if (!fields)
        throw new Error(
          `${classifier.name}: unsupported XMI operation "${raw}". Use + name(arg: Type): ReturnType.`,
        );
      const operationId = `${id}_o${index}`;
      const args = parameters(fields.parameters).map(
        (parameter, parameterIndex) =>
          tag('ownedParameter', {
            'xmi:id': `${operationId}_p${parameterIndex}`,
            name: parameter.name,
            direction: 'in',
            type: typeId(parameter.type),
          }),
      );
      if (fields.type)
        args.push(
          tag('ownedParameter', {
            'xmi:id': `${operationId}_return`,
            direction: 'return',
            type: typeId(fields.type),
          }),
        );
      body.push(
        tag(
          'ownedOperation',
          {
            'xmi:id': operationId,
            name: fields.name,
            visibility: visibility(fields.visibility),
          },
          args,
        ),
      );
    }
    if (classifier.description)
      body.push(
        tag('ownedComment', {
          'xmi:id': `${id}_comment`,
          body: classifier.description,
        }),
      );
    for (const relationship of relationships.filter(
      (item) =>
        item.from === classifier.id &&
        ['inheritance', 'realization'].includes(item.kind),
    )) {
      const relationId = relationIds.get(relationship.id) ?? '';
      const common = { 'xmi:id': relationId, name: relationship.label };
      body.push(
        relationship.kind === 'inheritance'
          ? tag('generalization', {
              ...common,
              general: ids.get(relationship.to),
            })
          : tag('interfaceRealization', {
              ...common,
              contract: ids.get(relationship.to),
              implementingClassifier: id,
              client: id,
              supplier: ids.get(relationship.to),
            }),
      );
    }
    body.push(
      tag('xmi:Extension', { extender: 'ArxDraw' }, [
        tag('arxdraw:classifier', {
          attributes: classifier.attributes,
          operations: classifier.operations,
        }),
      ]),
    );
    return tag(
      'packagedElement',
      {
        'xmi:type':
          classifier.kind === 'interface' ? 'uml:Interface' : 'uml:Class',
        'xmi:id': id,
        name: classifier.name,
        isAbstract: classifier.kind === 'abstract' ? 'true' : undefined,
      },
      body,
    );
  });
  const relationshipNodes = relationships
    .filter((item) => !['inheritance', 'realization'].includes(item.kind))
    .map((relationship) => {
      const id = relationIds.get(relationship.id) ?? '';
      if (relationship.kind === 'dependency')
        return tag('packagedElement', {
          'xmi:type': 'uml:Dependency',
          'xmi:id': id,
          name: relationship.label,
          client: ids.get(relationship.from),
          supplier: ids.get(relationship.to),
        });
      const source = `${id}_source`,
        target = `${id}_target`;
      return tag(
        'packagedElement',
        {
          'xmi:type': 'uml:Association',
          'xmi:id': id,
          name: relationship.label,
          memberEnd: `${source} ${target}`,
        },
        [
          tag(
            'ownedEnd',
            {
              'xmi:id': source,
              type: ids.get(relationship.from),
              association: id,
            },
            multiplicity(relationship.sourceMultiplicity, source),
          ),
          tag(
            'ownedEnd',
            {
              'xmi:id': target,
              type: ids.get(relationship.to),
              association: id,
              aggregation:
                relationship.kind === 'composition'
                  ? 'composite'
                  : relationship.kind === 'aggregation'
                    ? 'shared'
                    : undefined,
            },
            multiplicity(relationship.targetMultiplicity, target),
          ),
        ],
      );
    });
  // Relationship metadata retains empty multiplicities on links whose UML
  // metaclass has no association ends, and the original display text.
  const extensions = relationships.map((relationship) =>
    tag('arxdraw:relationship', {
      ref: relationIds.get(relationship.id),
      sourceMultiplicity: relationship.sourceMultiplicity,
      targetMultiplicity: relationship.targetMultiplicity,
    }),
  );
  const model = tag(
    'uml:Model',
    { 'xmi:id': 'model', name: diagram?.name ?? project.name },
    [
      ...[...primitives].map(([name, id]) =>
        tag('packagedElement', {
          'xmi:type': 'uml:PrimitiveType',
          'xmi:id': id,
          name,
        }),
      ),
      ...classifierNodes,
      ...relationshipNodes,
      tag('xmi:Extension', { extender: 'ArxDraw' }, extensions),
    ],
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${tag(
    'xmi:XMI',
    {
      'xmi:version': '2.1',
      'xmlns:xmi': 'http://schema.omg.org/spec/XMI/2.1',
      'xmlns:uml': 'http://www.eclipse.org/uml2/5.0.0/UML',
      'xmlns:arxdraw': 'https://arxdraw.app/xmi/1',
    },
    [model],
  )}\n`;
}

function readMultiplicity(end: XmlNode): string {
  const lower = children(end, 'lowerValue')[0],
    upper = children(end, 'upperValue')[0];
  if (
    !lower &&
    !upper &&
    attr(end, 'lower') === undefined &&
    attr(end, 'upper') === undefined
  )
    return '';
  const min =
    (lower ? (attr(lower, 'value') ?? '0') : attr(end, 'lower')) ?? '1';
  const max =
    (upper ? (attr(upper, 'value') ?? '0') : attr(end, 'upper')) ?? '1';
  const result = min === max ? max : `${min}..${max === '-1' ? '*' : max}`;
  multiplicity(result, 'check');
  return result;
}

function memberSemantics(
  value: string,
  kind: 'attributes' | 'operations',
): string | undefined {
  try {
    const result = value
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const fields = parseMember(line, kind).fields;
        if (!fields) throw new Error('Unrepresentable member notation.');
        return {
          visibility: fields.visibility,
          name: fields.name,
          type: fields.type,
          parameters:
            kind === 'operations' ? parameters(fields.parameters) : [],
        };
      });
    return JSON.stringify(result);
  } catch {
    return undefined;
  }
}
function matchingNotation(
  raw: string | undefined,
  structured: string,
  kind: 'attributes' | 'operations',
): string {
  if (raw === undefined) return structured;
  const semantics = memberSemantics(raw, kind);
  return semantics !== undefined &&
    semantics === memberSemantics(structured, kind)
    ? raw
    : structured;
}

export function importClassXmi(source: string): Project {
  const root = parseXml(source);
  if (
    localName(root.name) === 'XMI' &&
    (attr(root, 'xmi.version') ?? '').startsWith('1')
  )
    throw new Error(
      'UML 1 / ArgoUML XMI is not supported. Import a UML 2 class-model XMI file.',
    );
  const models =
    localName(root.name) === 'Model' ? [root] : children(root, 'Model');
  if (
    (localName(root.name) !== 'XMI' && localName(root.name) !== 'Model') ||
    models.length !== 1
  )
    throw new Error('XMI must contain one UML 2 Model.');
  if (
    localName(root.name) === 'XMI' &&
    root.children.some((node) => localName(node.name) !== 'Model')
  )
    throw new Error('Unsupported XMI content outside the UML Model.');
  const model = models[0];
  const ids = new Map<string, XmlNode>();
  const collect = (node: XmlNode) => {
    const id = xmlId(node);
    if (id !== undefined) {
      if (!id.trim() || ids.has(id))
        throw new Error(`Duplicate or empty XMI ID: ${id}.`);
      ids.set(id, node);
    }
    if (attr(node, 'href') !== undefined)
      throw new Error('External XMI references are not supported.');
    for (const child of node.children) collect(child);
  };
  collect(root);
  const project = createBlankProject();
  project.name = attr(model, 'name') ?? 'Imported classes';
  project.diagrams[0].name = project.name;
  project.diagrams[0].kind = 'class';
  const classMap = new Map<string, Classifier>();
  const packaged = children(model, 'packagedElement');
  for (const node of packaged) {
    const kind = nodeType(node);
    if (
      ![
        'Class',
        'Interface',
        'PrimitiveType',
        'DataType',
        'Association',
        'Dependency',
        'Realization',
        'InterfaceRealization',
        'Generalization',
      ].includes(kind)
    )
      throw new Error(
        `Unsupported XMI construct: ${kind}. ${xmiSubsetDescription}`,
      );
    if (kind !== 'Class' && kind !== 'Interface') continue;
    const id = xmlId(node);
    if (!id) throw new Error('Each XMI classifier needs an xmi:id.');
    const abstract = attr(node, 'isAbstract');
    if (
      abstract !== undefined &&
      !['true', 'false', '1', '0'].includes(abstract)
    )
      throw new Error('Invalid XMI isAbstract value.');
    const classifier: Classifier = {
      id: uid(),
      name: attr(node, 'name') ?? '',
      kind:
        kind === 'Interface'
          ? 'interface'
          : abstract === 'true' || abstract === '1'
            ? 'abstract'
            : 'class',
      attributes: '',
      operations: '',
      description: '',
    };
    classMap.set(id, classifier);
    project.classes.push(classifier);
  }
  const typeName = (node: XmlNode): string => {
    const ref = attr(node, 'type');
    if (!ref) {
      if (children(node, 'type').length)
        throw new Error(
          'Nested or external XMI type references are not supported.',
        );
      return '';
    }
    const target = ids.get(ref);
    if (
      !target ||
      !['Class', 'Interface', 'PrimitiveType', 'DataType'].includes(
        nodeType(target),
      )
    )
      throw new Error(`Unresolved XMI type reference: ${ref}.`);
    return attr(target, 'name') ?? '';
  };
  const classId = (ref: string | undefined): string => {
    const classifier = ref && classMap.get(ref);
    if (!classifier)
      throw new Error(
        `Unresolved or unsupported XMI classifier reference: ${ref ?? '(missing)'}.`,
      );
    return classifier.id;
  };
  const relationshipByXmlId = new Map<string, Relationship>();
  const addRelationship = (
    node: XmlNode,
    from: string | undefined,
    to: string | undefined,
    kind: Relationship['kind'],
    sourceMultiplicity = '',
    targetMultiplicity = '',
  ) => {
    const relationship: Relationship = {
      id: uid(),
      from: classId(from),
      to: classId(to),
      kind,
      label: attr(node, 'name') ?? '',
      sourceMultiplicity,
      targetMultiplicity,
    };
    const id = xmlId(node);
    if (id) relationshipByXmlId.set(id, relationship);
    project.relationships.push(relationship);
  };
  const ensureChildren = (node: XmlNode, allowed: string[]) => {
    for (const child of node.children)
      if (!allowed.includes(localName(child.name)))
        throw new Error(`Unsupported XMI construct: ${localName(child.name)}.`);
    if (node.text.trim())
      throw new Error(`Unexpected text in XMI ${localName(node.name)}.`);
  };
  ensureChildren(model, ['packagedElement', 'Extension', 'ownedComment']);
  for (const node of packaged) {
    const kind = nodeType(node),
      owner = xmlId(node);
    if (kind === 'Class' || kind === 'Interface') {
      const classifier = owner ? classMap.get(owner) : undefined;
      if (!classifier) throw new Error('Missing XMI classifier.');
      ensureChildren(node, [
        'ownedAttribute',
        'ownedOperation',
        'ownedComment',
        'generalization',
        'interfaceRealization',
        'Extension',
      ]);
      const fieldLines: string[] = [],
        operationLines: string[] = [];
      for (const field of children(node, 'ownedAttribute')) {
        if (attr(field, 'association')) continue;
        ensureChildren(field, ['type']);
        if (
          attr(field, 'isStatic') === 'true' ||
          attr(field, 'isReadOnly') === 'true'
        )
          throw new Error(
            'Static and read-only XMI attributes are not supported.',
          );
        const name = attr(field, 'name');
        if (!name) throw new Error('An XMI attribute needs a name.');
        const type = typeName(field);
        fieldLines.push(
          `${symbol(attr(field, 'visibility'))}${name}${type ? `: ${type}` : ''}`,
        );
      }
      for (const operation of children(node, 'ownedOperation')) {
        ensureChildren(operation, ['ownedParameter']);
        if (
          attr(operation, 'isStatic') === 'true' ||
          attr(operation, 'isAbstract') === 'true'
        )
          throw new Error(
            'Static and abstract XMI operations are not supported.',
          );
        const name = attr(operation, 'name');
        if (!name) throw new Error('An XMI operation needs a name.');
        const args: string[] = [];
        let result = '';
        for (const parameter of children(operation, 'ownedParameter')) {
          ensureChildren(parameter, ['type']);
          const direction = attr(parameter, 'direction') ?? 'in';
          const type = typeName(parameter);
          if (direction === 'return') {
            if (result)
              throw new Error(
                'Multiple XMI return parameters are not supported.',
              );
            result = type;
          } else {
            if (direction !== 'in')
              throw new Error(
                `Unsupported XMI parameter direction: ${direction}.`,
              );
            const parameterName = attr(parameter, 'name');
            if (!parameterName)
              throw new Error('An XMI parameter needs a name.');
            args.push(`${parameterName}${type ? `: ${type}` : ''}`);
          }
        }
        operationLines.push(
          `${symbol(attr(operation, 'visibility'))}${name}(${args.join(', ')})${result ? `: ${result}` : ''}`,
        );
      }
      classifier.attributes = fieldLines.join('\n');
      classifier.operations = operationLines.join('\n');
      classifier.description = children(node, 'ownedComment')
        .map(
          (comment) =>
            attr(comment, 'body') ?? children(comment, 'body')[0]?.text ?? '',
        )
        .join('\n');
      for (const extension of children(node, 'Extension')) {
        if (attr(extension, 'extender') !== 'ArxDraw')
          throw new Error('Unsupported XMI extension.');
        const raw = children(extension, 'classifier')[0];
        if (raw) {
          classifier.attributes = matchingNotation(
            attr(raw, 'attributes'),
            classifier.attributes,
            'attributes',
          );
          classifier.operations = matchingNotation(
            attr(raw, 'operations'),
            classifier.operations,
            'operations',
          );
        }
      }
      for (const relationship of children(node, 'generalization'))
        addRelationship(
          relationship,
          owner,
          attr(relationship, 'general'),
          'inheritance',
        );
      for (const relationship of children(node, 'interfaceRealization'))
        addRelationship(
          relationship,
          owner,
          attr(relationship, 'contract') ?? attr(relationship, 'supplier'),
          'realization',
        );
    } else if (kind === 'Association') {
      ensureChildren(node, ['ownedEnd', 'ownedComment']);
      const references = attr(node, 'memberEnd')?.trim().split(/\s+/);
      const ends = references
        ? references.map((ref) => ids.get(ref))
        : children(node, 'ownedEnd');
      const first = ends[0],
        second = ends[1];
      if (ends.length !== 2 || !first || !second)
        throw new Error(
          'Only binary XMI associations with two resolved ends are supported.',
        );
      if ([first, second].some((end) => (attr(end, 'name') ?? '').trim()))
        throw new Error('Named XMI association end roles are not supported.');
      if (
        attr(node, 'navigableOwnedEnd') !== undefined ||
        [first, second].some((end) => attr(end, 'isNavigable') !== undefined)
      )
        throw new Error('XMI association navigability is not supported.');
      const aggregationA = attr(first, 'aggregation') ?? 'none',
        aggregationB = attr(second, 'aggregation') ?? 'none';
      if (
        ![aggregationA, aggregationB].every((value) =>
          ['none', 'shared', 'composite'].includes(value),
        ) ||
        (aggregationA !== 'none' && aggregationB !== 'none')
      )
        throw new Error('Unsupported XMI association aggregation.');
      // A composite/shared Property is typed by the part; its opposite end
      // is the whole, where ArxDraw draws the diamond.
      const reverse = aggregationA !== 'none';
      const from = reverse ? second : first,
        to = reverse ? first : second;
      const aggregation = aggregationA !== 'none' ? aggregationA : aggregationB;
      for (const end of [from, to])
        ensureChildren(end, ['lowerValue', 'upperValue']);
      addRelationship(
        node,
        attr(from, 'type'),
        attr(to, 'type'),
        aggregation === 'composite'
          ? 'composition'
          : aggregation === 'shared'
            ? 'aggregation'
            : 'association',
        readMultiplicity(from),
        readMultiplicity(to),
      );
    } else if (
      kind === 'Dependency' ||
      kind === 'Realization' ||
      kind === 'InterfaceRealization' ||
      kind === 'Generalization'
    ) {
      ensureChildren(node, ['ownedComment']);
      addRelationship(
        node,
        attr(node, 'client') ?? attr(node, 'specific'),
        attr(node, 'supplier') ?? attr(node, 'general'),
        kind === 'Dependency'
          ? 'dependency'
          : kind === 'Generalization'
            ? 'inheritance'
            : 'realization',
      );
    } else ensureChildren(node, []);
  }
  for (const extension of children(model, 'Extension')) {
    if (attr(extension, 'extender') !== 'ArxDraw')
      throw new Error('Unsupported XMI extension.');
    for (const metadata of children(extension, 'relationship')) {
      const ref = attr(metadata, 'ref'),
        relationship = ref ? relationshipByXmlId.get(ref) : undefined;
      if (!relationship)
        throw new Error(`Unresolved ArxDraw relationship metadata: ${ref}.`);
      relationship.sourceMultiplicity =
        attr(metadata, 'sourceMultiplicity') ?? relationship.sourceMultiplicity;
      relationship.targetMultiplicity =
        attr(metadata, 'targetMultiplicity') ?? relationship.targetMultiplicity;
    }
  }
  project.diagrams[0].classIds = project.classes.map(
    (classifier) => classifier.id,
  );
  project.diagrams[0].relationshipIds = project.relationships.map(
    (relationship) => relationship.id,
  );
  return parseProject(JSON.stringify(project));
}
