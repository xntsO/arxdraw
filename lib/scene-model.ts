import { uid } from './model.ts';
import type { Project, Relationship, SceneElement } from './model.ts';
import { isRecord } from './project-parse.ts';

const groupsOf = (element: SceneElement): string[] =>
  Array.isArray(element.groupIds)
    ? element.groupIds.filter((id): id is string => typeof id === 'string')
    : [];

function unmanaged(element: SceneElement): SceneElement {
  const customData = { ...element.customData };
  delete customData.arxdraw;
  delete customData.modelId;
  delete customData.relationshipId;
  delete customData.role;
  for (const key of [
    'from',
    'to',
    'kind',
    'navigable',
    'routePoints',
    'manualRoute',
  ])
    delete customData[key];
  return { ...element, customData };
}
function demoteViews(
  elements: SceneElement[],
  diagramId: string,
  demotedIds: Set<string>,
): SceneElement[] {
  const relationshipIds = new Set(
    elements
      .filter((element) => demotedIds.has(element.id))
      .map((element) => element.customData?.relationshipId)
      .filter((id): id is string => !!id),
  );
  const survivingOriginals = new Set(
    elements
      .filter(
        (element) =>
          element.type === 'arrow' &&
          !element.isDeleted &&
          !demotedIds.has(element.id) &&
          element.customData?.relationshipId &&
          element.id ===
            `rel-${diagramId}-${element.customData.relationshipId}`,
      )
      .map((element) => element.customData?.relationshipId),
  );
  return elements.map((element) => {
    if (
      demotedIds.has(element.id) ||
      (typeof element.containerId === 'string' &&
        demotedIds.has(element.containerId))
    )
      return unmanaged(element);
    const id = element.customData?.relationshipId;
    if (element.type !== 'text' || !id || !relationshipIds.has(id))
      return element;
    if (
      typeof element.containerId === 'string' &&
      !demotedIds.has(element.containerId)
    )
      return element;
    if (
      survivingOriginals.has(id) &&
      element.id.startsWith(`rel-${diagramId}-${id}-`)
    )
      return element;
    return unmanaged(element);
  });
}

/** Give native Excalidraw copies their own shared UML classifier. */
export function reconcileDuplicatedClasses(
  project: Project,
  diagramId: string,
): Project {
  const diagram = project.diagrams.find((d) => d.id === diagramId);
  if (!diagram) return project;
  const classifiers = new Map(project.classes.map((c) => [c.id, c]));
  const foreignIds = new Set<string>();
  for (const element of diagram.elements) {
    const modelId = element.customData?.modelId;
    const relationshipId = element.customData?.relationshipId;
    if (
      element.customData?.arxdraw &&
      ((modelId && !classifiers.has(modelId)) ||
        (relationshipId &&
          !project.relationships.some(
            (relationship) => relationship.id === relationshipId,
          )))
    )
      foreignIds.add(element.id);
  }
  if (foreignIds.size)
    return reconcileDuplicatedClasses(
      {
        ...project,
        diagrams: project.diagrams.map((item) =>
          item.id === diagramId
            ? {
                ...item,
                elements: demoteViews(diagram.elements, diagramId, foreignIds),
              }
            : item,
        ),
      },
      diagramId,
    );
  const boxes = new Map<string, SceneElement[]>();
  for (const element of diagram.elements) {
    const modelId = element.customData?.modelId;
    if (
      element.isDeleted ||
      element.customData?.role !== 'box' ||
      !modelId ||
      !classifiers.has(modelId)
    )
      continue;
    boxes.set(modelId, [...(boxes.get(modelId) ?? []), element]);
  }
  if (
    ![...boxes].some(
      ([id, items]) => items.length > 1 || !diagram.classIds.includes(id),
    )
  )
    return project;
  const classes = [...project.classes],
    classIds = [...diagram.classIds];
  const names = new Set(classes.map((c) => c.name.trim()));
  const replacements = new Map<string, string>();
  for (const [modelId, copies] of boxes) {
    // A paste from another diagram is another view of the shared classifier.
    if (!classIds.includes(modelId)) classIds.push(modelId);
    if (copies.length < 2) continue;
    const original =
      copies.find((box) => box.id === `uml-${diagram.id}-${modelId}-box`) ??
      copies[0];
    const classifier = classifiers.get(modelId)!;
    for (const box of copies) {
      if (box === original) continue;
      const id = uid();
      const rawName = classifier.name.trim() || 'Class';
      const match = rawName.match(/^(.*?)(\d+)$/);
      const base = match?.[1] || rawName;
      let index = match ? Number(match[2]) + 1 : 2;
      // Extremely long numeric names must not make suffix arithmetic stall.
      if (!Number.isSafeInteger(index)) index = 2;
      let name = `${base}${index}`;
      while (names.has(name)) {
        index = Number.isSafeInteger(index + 1) ? index + 1 : 2;
        name = `${base}${index}`;
      }
      names.add(name);
      classes.push({ ...classifier, id, name });
      classIds.push(id);
      replacements.set(box.id, id);
      // Groups can be nested. Only a group exclusive to this particular copy
      // identifies its parts; a shared outer group must never absorb originals.
      const otherGroups = new Set(
        copies.filter((other) => other !== box).flatMap(groupsOf),
      );
      const ownGroups = new Set(
        groupsOf(box).filter((group) => !otherGroups.has(group)),
      );
      if (!ownGroups.size) continue;
      for (const part of diagram.elements) {
        if (
          part.isDeleted ||
          part.customData?.modelId !== modelId ||
          part.customData.role === 'box' ||
          part.customData.relationshipId
        )
          continue;
        if (groupsOf(part).some((group) => ownGroups.has(group)))
          replacements.set(part.id, id);
      }
    }
  }
  const elements = diagram.elements.map((element) => {
    const modelId = replacements.get(element.id);
    return modelId
      ? { ...element, customData: { ...element.customData, modelId } }
      : element;
  });
  return {
    ...project,
    classes,
    diagrams: project.diagrams.map((d) =>
      d.id === diagramId ? { ...d, classIds, elements } : d,
    ),
  };
}

function endpointId(
  arrow: SceneElement,
  key: 'startBinding' | 'endBinding',
): string | undefined {
  const binding = arrow[key];
  return isRecord(binding) && typeof binding.elementId === 'string'
    ? binding.elementId
    : undefined;
}

/** Promote bound native class arrows and retain relationships in copied selections.
 * Call after reconcileDuplicatedClasses, once the native drawing gesture finishes.
 * Unbound arrows and arrows involving freehand shapes stay native drawings.
 */
export function reconcileClassRelationships(
  project: Project,
  diagramId: string,
  options: { defaultKind?: Relationship['kind'] } = {},
): Project {
  const diagram = project.diagrams.find((item) => item.id === diagramId);
  if (!diagram || (diagram.kind !== undefined && diagram.kind !== 'class'))
    return project;
  const classParts = new Map(
    diagram.elements
      .filter(
        (element) =>
          !element.isDeleted &&
          element.customData?.modelId &&
          diagram.classIds.includes(element.customData.modelId),
      )
      .map((element) => [element.id, element]),
  );
  const relationships = [...project.relationships],
    relationshipIds = [...diagram.relationshipIds];
  const byId = new Map(
    relationships.map((relationship) => [relationship.id, relationship]),
  );
  const originals = new Map<string, string>();
  for (const element of diagram.elements) {
    const id = element.customData?.relationshipId;
    if (element.type !== 'arrow' || element.isDeleted || !id || !byId.has(id))
      continue;
    if (!originals.has(id) || element.id === `rel-${diagram.id}-${id}`)
      originals.set(id, element.id);
  }
  let changed = false;
  const promotedLabels = new Map<string, string>();
  const demotedIds = new Set<string>();
  const elements = diagram.elements.map((arrow) => {
    if (arrow.isDeleted || arrow.type !== 'arrow') return arrow;
    const start = endpointId(arrow, 'startBinding'),
      end = endpointId(arrow, 'endBinding');
    const from = start ? classParts.get(start)?.customData?.modelId : undefined;
    const to = end ? classParts.get(end)?.customData?.modelId : undefined;
    if (!from || !to) {
      const id = arrow.customData?.relationshipId;
      if (
        id &&
        arrow.id !== `rel-${diagram.id}-${id}` &&
        arrow.customData?.arxdraw
      ) {
        changed = true;
        demotedIds.add(arrow.id);
        return unmanaged(arrow);
      }
      return arrow;
    }
    const existingId = arrow.customData?.relationshipId;
    const existing = existingId ? byId.get(existingId) : undefined;
    const sameEndpoints = existing?.from === from && existing?.to === to;
    const navigable = arrow.endArrowhead === 'arrow' ? 'target' : undefined;
    if (
      existing &&
      originals.get(existing.id) === arrow.id &&
      (diagram.relationshipIds.includes(existing.id) || sameEndpoints)
    ) {
      if (!relationshipIds.includes(existing.id)) {
        relationshipIds.push(existing.id);
        changed = true;
      }
      const navigationChanged =
        existing.kind === 'association' &&
        arrow.endArrowhead !== undefined &&
        existing.navigable !== navigable;
      if (existing.from !== from || existing.to !== to || navigationChanged) {
        const replacement = { ...existing, from, to };
        if (navigationChanged) {
          if (navigable) replacement.navigable = navigable;
          else delete replacement.navigable;
        }
        relationships[
          relationships.findIndex((item) => item.id === existing.id)
        ] = replacement;
        byId.set(existing.id, replacement);
        changed = true;
        return { ...arrow, customData: { ...arrow.customData, from, to } };
      }
      return arrow;
    }
    // Never interpret arbitrary generated annotations as a new relationship.
    if (!existing && arrow.customData?.arxdraw) return arrow;
    const labels = diagram.elements.filter(
      (element) =>
        !element.isDeleted &&
        element.type === 'text' &&
        element.containerId === arrow.id &&
        typeof element.text === 'string',
    );
    const label = labels
      .map((element) => (typeof element.text === 'string' ? element.text : ''))
      .join('\n');
    const kind: Relationship['kind'] =
      options.defaultKind ??
      (arrow.startArrowhead === 'diamond'
        ? 'composition'
        : arrow.startArrowhead === 'diamond_outline'
          ? 'aggregation'
          : arrow.endArrowhead === 'triangle_outline'
            ? arrow.strokeStyle === 'dashed'
              ? 'realization'
              : 'inheritance'
            : arrow.strokeStyle === 'dashed'
              ? 'dependency'
              : 'association');
    const relationship: Relationship = existing
      ? { ...existing, id: uid(), from, to }
      : {
          id: uid(),
          from,
          to,
          kind,
          label,
          sourceMultiplicity: '',
          targetMultiplicity: '',
        };
    if (
      relationship.kind === 'association' &&
      arrow.endArrowhead !== undefined
    ) {
      if (navigable) relationship.navigable = navigable;
      else delete relationship.navigable;
    }
    relationships.push(relationship);
    relationshipIds.push(relationship.id);
    byId.set(relationship.id, relationship);
    for (const text of labels) promotedLabels.set(text.id, relationship.id);
    changed = true;
    return {
      ...arrow,
      customData: {
        ...arrow.customData,
        arxdraw: true,
        relationshipId: relationship.id,
        from,
        to,
        kind: relationship.kind,
        manualRoute: true,
      },
    };
  });
  if (!changed) return project;
  const annotatedElements = (
    demotedIds.size
      ? demoteViews(diagram.elements, diagramId, demotedIds).map(
          (element, index) =>
            element !== diagram.elements[index] ? element : elements[index],
        )
      : elements
  ).map((element) => {
    const relationshipId = promotedLabels.get(element.id);
    return relationshipId
      ? {
          ...element,
          customData: {
            ...element.customData,
            arxdraw: true,
            relationshipId,
            role: 'label',
          },
        }
      : element;
  });
  return {
    ...project,
    relationships,
    diagrams: project.diagrams.map((item) =>
      item.id === diagramId
        ? { ...item, elements: annotatedElements, relationshipIds }
        : item,
    ),
  };
}
