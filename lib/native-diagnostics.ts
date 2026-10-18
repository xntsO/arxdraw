import type { Project } from './model.ts';
import type { ProjectDiagnostic } from './diagnostics.ts';

export function nativeUmlDiagnostics(project: Project): ProjectDiagnostic[] {
  const model = project.nativeModel;
  if (!model) return [];
  const diagnostics: ProjectDiagnostic[] = [];
  const byId = new Map(model.elements.map((element) => [element.id, element]));
  const add = (
    code: string,
    severity: ProjectDiagnostic['severity'],
    message: string,
    suggestion: string,
    nativeElementIds: string[],
    nativeRelationshipIds: string[] = [],
    diagramIds?: string[],
  ) => {
    const affected =
      diagramIds ??
      project.diagrams
        .filter(
          (diagram) =>
            diagram.nativeElementIds?.some((id) =>
              nativeElementIds.includes(id),
            ) ||
            diagram.nativeRelationshipIds?.some((id) =>
              nativeRelationshipIds.includes(id),
            ),
        )
        .map((diagram) => diagram.id);
    diagnostics.push({
      id: JSON.stringify([
        code,
        [...nativeElementIds].sort(),
        [...nativeRelationshipIds].sort(),
        [...affected].sort(),
      ]),
      code,
      severity,
      message,
      suggestion,
      classIds: [],
      relationshipIds: [],
      diagramIds: affected,
      nativeElementIds,
      nativeRelationshipIds,
    });
  };
  const names = new Map<string, string>();
  for (const element of model.elements) {
    if (!element.name.trim())
      add(
        'native.missing-name',
        'error',
        'A UML element needs a name.',
        'Name this element in Properties.',
        [element.id],
      );
    const key = `${element.kind}\0${element.name.trim()}`;
    const previous = names.get(key);
    if (previous && element.name.trim())
      add(
        'native.duplicate-name',
        'warning',
        `Duplicate ${element.kind} name: ${element.name}.`,
        'Rename one element, or reuse the same shared element in both diagrams.',
        [previous, element.id],
      );
    else names.set(key, element.id);
  }
  for (const relationship of model.relationships) {
    const source = byId.get(relationship.from),
      target = byId.get(relationship.to);
    if (!source || !target) {
      add(
        'native.missing-endpoint',
        'error',
        'A UML relationship refers to a missing element.',
        'Reconnect or remove the relationship.',
        [relationship.from, relationship.to],
        [relationship.id],
      );
      continue;
    }
    if (
      ['include', 'extend'].includes(relationship.kind) &&
      (source.kind !== 'use-case' || target.kind !== 'use-case')
    )
      add(
        'native.use-case-endpoint',
        'error',
        'Include and extend must connect two use cases.',
        'Connect both ends to use cases.',
        [source.id, target.id],
        [relationship.id],
      );
    if (
      source.kind === 'final' &&
      ['transition', 'flow'].includes(relationship.kind)
    )
      add(
        'native.final-outgoing',
        'error',
        'A final node has an outgoing flow or transition.',
        'Remove this outgoing relationship or use a regular state or action.',
        [source.id],
        [relationship.id],
      );
    if (relationship.kind === 'data-flow') {
      if (!relationship.name.trim())
        add(
          'dfd.unnamed-flow',
          'warning',
          'A data flow needs a name.',
          'Label the arrow with the data being transferred.',
          [source.id, target.id],
          [relationship.id],
        );
      if (source.kind !== 'dfd-process' && target.kind !== 'dfd-process')
        add(
          'dfd.missing-process',
          'warning',
          'A data flow must connect to at least one process.',
          'Route data between an entity or store and a process.',
          [source.id, target.id],
          [relationship.id],
        );
    }
  }
  for (const diagram of project.diagrams) {
    const elementIds = new Set(diagram.nativeElementIds ?? []);
    const elements = model.elements.filter((element) =>
      elementIds.has(element.id),
    );
    const relationshipIds = new Set(diagram.nativeRelationshipIds ?? []);
    const relationships = model.relationships.filter((relationship) =>
      relationshipIds.has(relationship.id),
    );
    if (diagram.kind === 'data-flow') {
      const flows = relationships.filter(
        (relationship) => relationship.kind === 'data-flow',
      );
      for (const element of elements.filter((element) =>
        ['dfd-process', 'dfd-entity', 'dfd-store'].includes(element.kind),
      )) {
        const incoming = flows.filter((flow) => flow.to === element.id);
        const outgoing = flows.filter((flow) => flow.from === element.id);
        if (!incoming.length && !outgoing.length)
          add(
            'dfd.disconnected-node',
            'warning',
            `"${element.name}" has no data flows in this diagram.`,
            'Connect this element to a process using a named data flow.',
            [element.id],
            [],
            [diagram.id],
          );
        if (
          element.kind === 'dfd-process' &&
          (!incoming.length || !outgoing.length)
        )
          add(
            'dfd.process-io',
            'warning',
            `Process "${element.name}" needs ${!incoming.length && !outgoing.length ? 'input and output data flows' : !incoming.length ? 'an input data flow' : 'an output data flow'}.`,
            'Show the data the process receives and the data it produces.',
            [element.id],
            [],
            [diagram.id],
          );
      }
    }
    if (diagram.kind === 'use-case')
      for (const element of elements.filter(
        (element) => element.kind === 'actor',
      ))
        if (
          !relationships.some(
            (relationship) =>
              relationship.from === element.id ||
              relationship.to === element.id,
          )
        )
          add(
            'native.actor-disconnected',
            'warning',
            `Actor "${element.name}" has no relationship in this diagram.`,
            'Connect the actor to a use case.',
            [element.id],
            [],
            [diagram.id],
          );
    if (
      !elements.length ||
      (diagram.kind !== 'state' && diagram.kind !== 'activity')
    )
      continue;
    const initials = elements.filter((element) => element.kind === 'initial');
    if (initials.length !== 1)
      add(
        initials.length ? 'native.multiple-initials' : 'native.missing-initial',
        'warning',
        initials.length
          ? 'This diagram has more than one initial node.'
          : 'This diagram has no initial node.',
        'Use one initial node for a simple state or activity flow.',
        initials.map((element) => element.id),
        [],
        [diagram.id],
      );
    const flows = relationships.filter(
      (relationship) =>
        relationship.kind === 'transition' || relationship.kind === 'flow',
    );
    if (initials.length === 1) {
      const reachable = new Set([initials[0].id]);
      const outgoing = new Map<string, string[]>();
      for (const flow of flows)
        outgoing.set(flow.from, [...(outgoing.get(flow.from) ?? []), flow.to]);
      const queue = [initials[0].id];
      for (let index = 0; index < queue.length; index++)
        for (const target of outgoing.get(queue[index]) ?? [])
          if (!reachable.has(target)) {
            reachable.add(target);
            queue.push(target);
          }
      const unreachable = elements.filter(
        (element) =>
          ['state', 'action', 'final', 'decision', 'choice', 'fork'].includes(
            element.kind,
          ) && !reachable.has(element.id),
      );
      if (unreachable.length)
        add(
          'native.unreachable',
          'warning',
          'Some nodes cannot be reached from the initial node.',
          'Connect these nodes to the main flow or remove their views.',
          unreachable.map((element) => element.id),
          [],
          [diagram.id],
        );
    }
    for (const decision of elements.filter(
      (element) => element.kind === 'decision' || element.kind === 'choice',
    )) {
      const outgoing = flows.filter(
        (relationship) => relationship.from === decision.id,
      );
      if (
        outgoing.length > 1 &&
        outgoing.some((relationship) => !/\[[^\]]+\]/.test(relationship.name))
      )
        add(
          'native.missing-guard',
          'warning',
          'A decision or choice has an outgoing branch without a guard.',
          'Add a condition such as [approved] or [else] to each branch label.',
          [decision.id],
          outgoing.map((relationship) => relationship.id),
          [diagram.id],
        );
    }
  }
  return diagnostics;
}
