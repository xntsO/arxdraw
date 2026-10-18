import type { Project } from './model.ts';
import { nativeUmlDiagnostics } from './native-diagnostics.ts';

export type ProjectDiagnostic = {
  id: string;
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
  classIds: string[];
  relationshipIds: string[];
  diagramIds: string[];
  nativeElementIds?: string[];
  nativeRelationshipIds?: string[];
};

const validMultiplicity = (value: string) =>
  !value.trim() ||
  value.split(',').every((part) => {
    const match = /^(\d+|\*)(?:\s*\.\.\s*(\d+|\*))?$/.exec(part.trim());
    if (!match) return false;
    if (!match[2]) return true;
    return (
      match[1] !== '*' &&
      (match[2] === '*' || Number(match[1]) <= Number(match[2]))
    );
  });

export function projectDiagnostics(project: Project): ProjectDiagnostic[] {
  const diagnostics: ProjectDiagnostic[] = [];
  const classes = new Map(project.classes.map((item) => [item.id, item]));
  const add = (
    code: string,
    severity: ProjectDiagnostic['severity'],
    message: string,
    suggestion: string,
    classIds: string[] = [],
    relationshipIds: string[] = [],
    diagramIds?: string[],
  ) => {
    const affectedDiagrams =
      diagramIds ??
      project.diagrams
        .filter(
          (diagram) =>
            diagram.classIds.some((id) => classIds.includes(id)) ||
            diagram.relationshipIds.some((id) => relationshipIds.includes(id)),
        )
        .map((diagram) => diagram.id);
    diagnostics.push({
      id: JSON.stringify([
        code,
        [...classIds].sort(),
        [...relationshipIds].sort(),
        diagramIds ? [...diagramIds].sort() : [],
      ]),
      code,
      severity,
      message,
      suggestion,
      classIds,
      relationshipIds,
      diagramIds: affectedDiagrams,
    });
  };
  const names = new Map<string, string>();
  for (const classifier of project.classes) {
    const name = classifier.name.trim();
    if (!name)
      add(
        'classifier.missing-name',
        'error',
        'A classifier needs a name.',
        'Name this classifier in the inspector.',
        [classifier.id],
      );
    else {
      const previous = names.get(name);
      if (previous)
        add(
          'classifier.duplicate-name',
          'warning',
          `Duplicate classifier name: ${classifier.name}.`,
          'Use distinct names so references and generated code are unambiguous.',
          [previous, classifier.id],
        );
      else names.set(name, classifier.id);
    }
  }
  const parents = new Map<string, string[]>();
  const compositionOwners = new Map<
    string,
    { owners: Set<string>; relationships: string[] }
  >();
  for (const relationship of project.relationships) {
    const source = classes.get(relationship.from),
      target = classes.get(relationship.to);
    if (!source || !target) {
      add(
        'relationship.missing-endpoint',
        'error',
        'A relationship refers to a missing classifier.',
        'Reconnect or remove this relationship.',
        [relationship.from, relationship.to],
        [relationship.id],
      );
      continue;
    }
    if (relationship.kind === 'realization' && target.kind !== 'interface')
      add(
        'realization.target',
        'error',
        'A realization should point to an interface.',
        'Choose an interface as the target, or change the relationship kind.',
        [source.id, target.id],
        [relationship.id],
      );
    if (relationship.kind === 'inheritance') {
      parents.set(source.id, [...(parents.get(source.id) ?? []), target.id]);
      if ((source.kind === 'interface') !== (target.kind === 'interface'))
        add(
          'inheritance.kind',
          'warning',
          'Inheritance should connect classes to classes or interfaces to interfaces.',
          'Use realization when a class implements an interface.',
          [source.id, target.id],
          [relationship.id],
        );
    }
    if (
      !validMultiplicity(relationship.sourceMultiplicity) ||
      !validMultiplicity(relationship.targetMultiplicity)
    )
      add(
        'relationship.multiplicity',
        'warning',
        'A relationship has an invalid multiplicity.',
        'Use a nonnegative integer, *, or a range such as 0..1 or 1..*.',
        [source.id, target.id],
        [relationship.id],
      );
    if (relationship.kind === 'composition') {
      const ownership = compositionOwners.get(target.id) ?? {
        owners: new Set<string>(),
        relationships: [],
      };
      ownership.owners.add(source.id);
      ownership.relationships.push(relationship.id);
      compositionOwners.set(target.id, ownership);
      if (source.id === target.id)
        add(
          'composition.self',
          'error',
          'A classifier cannot compose itself.',
          'Connect composition to a separate part classifier.',
          [source.id],
          [relationship.id],
        );
    }
  }
  for (const [part, ownership] of compositionOwners)
    if (ownership.owners.size > 1)
      add(
        'composition.multiple-owners',
        'warning',
        'A part has more than one composite owner.',
        'Check that each part instance belongs to only one whole at a time.',
        [part, ...ownership.owners],
        ownership.relationships,
      );

  // Iterative traversal avoids overflowing the stack on large imported hierarchies.
  const finished = new Set<string>(),
    active = new Set<string>(),
    reported = new Set<string>();
  for (const classifier of project.classes) {
    if (finished.has(classifier.id)) continue;
    const path: string[] = [];
    const stack = [{ id: classifier.id, index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!active.has(frame.id)) {
        active.add(frame.id);
        path.push(frame.id);
      }
      const next = (parents.get(frame.id) ?? [])[frame.index++];
      if (next === undefined) {
        finished.add(frame.id);
        active.delete(frame.id);
        path.pop();
        stack.pop();
      } else if (active.has(next)) {
        const cycle = path.slice(path.indexOf(next));
        const key = [...cycle].sort().join('\0');
        if (!reported.has(key)) {
          reported.add(key);
          const members = new Set(cycle);
          add(
            'inheritance.cycle',
            'error',
            'Inheritance contains a cycle.',
            'Remove an inheritance link so no classifier is its own ancestor.',
            cycle,
            project.relationships
              .filter(
                (relationship) =>
                  relationship.kind === 'inheritance' &&
                  members.has(relationship.from) &&
                  members.has(relationship.to),
              )
              .map((relationship) => relationship.id),
          );
        }
      } else if (!finished.has(next)) stack.push({ id: next, index: 0 });
    }
  }
  const relationshipIds = new Set(
    project.relationships.map((relationship) => relationship.id),
  );
  for (const diagram of project.diagrams) {
    const missingClasses = diagram.classIds.filter((id) => !classes.has(id));
    const missingRelationships = diagram.relationshipIds.filter(
      (id) => !relationshipIds.has(id),
    );
    if (missingClasses.length || missingRelationships.length)
      add(
        'diagram.missing-reference',
        'error',
        `Diagram "${diagram.name}" contains missing model references.`,
        'Remove the missing references from this diagram.',
        missingClasses,
        missingRelationships,
        [diagram.id],
      );
  }
  return [...diagnostics, ...nativeUmlDiagnostics(project)];
}
