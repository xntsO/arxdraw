import { uid } from './model.ts';
import type { Project, SceneElement } from './model.ts';

const groupsOf = (element: SceneElement): string[] =>
  Array.isArray(element.groupIds)
    ? element.groupIds.filter((id): id is string => typeof id === 'string')
    : [];

/** Give native Excalidraw copies their own shared UML classifier. */
export function reconcileDuplicatedClasses(
  project: Project,
  diagramId: string,
): Project {
  const diagram = project.diagrams.find((d) => d.id === diagramId);
  if (!diagram) return project;
  const classifiers = new Map(project.classes.map((c) => [c.id, c]));
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
  if (![...boxes.values()].some((items) => items.length > 1)) return project;
  const classes = [...project.classes],
    classIds = [...diagram.classIds];
  const names = new Set(classes.map((c) => c.name.trim()));
  const replacements = new Map<string, string>();
  for (const [modelId, copies] of boxes) {
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
