import { parseProject } from './project-parse.ts';
import { uid } from './model.ts';
import type { Diagram, Project, SceneElement } from './model.ts';
import { isRecord } from './project-parse.ts';
import {
  isNativeRelationshipKind,
  isNativeUmlMetadata,
} from './native-model-types.ts';

type IdMaps = {
  classes: Map<string, string>;
  relationships: Map<string, string>;
  files: Map<string, string>;
  nativeElements: Map<string, string>;
  nativeRelationships: Map<string, string>;
};
const mapped = (map: Map<string, string>, value: string) =>
  map.get(value) ?? value;

function copyDiagram(
  diagram: Diagram,
  diagramId: string,
  maps: IdMaps,
): Diagram {
  const groups = new Map<string, string>();
  const elements = new Map<string, string>();
  for (const element of diagram.elements) {
    const modelId = element.customData?.modelId,
      relationshipId = element.customData?.relationshipId;
    const role = element.customData?.role;
    // Generated identifiers must match the next UML redraw, so styles and routes survive it.
    const generatedClass =
      modelId && role && element.id === `uml-${diagram.id}-${modelId}-${role}`;
    const relationshipBase = relationshipId
      ? `rel-${diagram.id}-${relationshipId}`
      : '';
    const generatedRelationship =
      relationshipId &&
      (element.id === relationshipBase ||
        (role && element.id === `${relationshipBase}-${role}`));
    elements.set(
      element.id,
      generatedClass
        ? `uml-${diagramId}-${mapped(maps.classes, modelId)}-${role}`
        : generatedRelationship
          ? `rel-${diagramId}-${mapped(maps.relationships, relationshipId)}${role ? `-${role}` : ''}`
          : uid(),
    );
    if (Array.isArray(element.groupIds))
      for (const group of element.groupIds) {
        if (typeof group !== 'string' || groups.has(group)) continue;
        groups.set(
          group,
          modelId && group === `uml-${diagram.id}-${modelId}`
            ? `uml-${diagramId}-${mapped(maps.classes, modelId)}`
            : uid(),
        );
      }
  }
  const remapElement = (element: SceneElement): SceneElement => {
    const copied = structuredClone(element);
    copied.id = mapped(elements, element.id);
    for (const key of ['containerId', 'frameId'])
      if (typeof copied[key] === 'string')
        copied[key] = mapped(elements, copied[key]);
    if (typeof copied.fileId === 'string')
      copied.fileId = mapped(maps.files, copied.fileId);
    if (Array.isArray(copied.groupIds))
      copied.groupIds = copied.groupIds.map((id: unknown) =>
        typeof id === 'string' ? mapped(groups, id) : id,
      );
    for (const key of ['startBinding', 'endBinding']) {
      const binding = copied[key];
      if (isRecord(binding) && typeof binding.elementId === 'string')
        copied[key] = {
          ...binding,
          elementId: mapped(elements, binding.elementId),
        };
    }
    for (const key of ['start', 'end']) {
      const binding = copied[key];
      if (isRecord(binding) && typeof binding.id === 'string')
        copied[key] = { ...binding, id: mapped(elements, binding.id) };
    }
    if (Array.isArray(copied.boundElements))
      copied.boundElements = copied.boundElements.map((binding: unknown) =>
        isRecord(binding) && typeof binding.id === 'string'
          ? { ...binding, id: mapped(elements, binding.id) }
          : binding,
      );
    if (copied.customData) {
      for (const key of ['modelId', 'from', 'to']) {
        const id = copied.customData[key];
        if (typeof id === 'string')
          copied.customData[key] = mapped(maps.classes, id);
      }
      const id = copied.customData.relationshipId;
      if (id) copied.customData.relationshipId = mapped(maps.relationships, id);
      const native = copied.customData.uml;
      if (isNativeUmlMetadata(native))
        copied.customData.uml = {
          ...native,
          id:
            maps.nativeElements.get(native.id) ??
            mapped(maps.nativeRelationships, native.id),
          ...(native.viewId ? { viewId: mapped(elements, native.viewId) } : {}),
        };
    }
    return copied;
  };
  return {
    ...structuredClone(diagram),
    id: diagramId,
    classIds: diagram.classIds.map((id) => mapped(maps.classes, id)),
    relationshipIds: diagram.relationshipIds.map((id) =>
      mapped(maps.relationships, id),
    ),
    ...(diagram.nativeElementIds
      ? {
          nativeElementIds: diagram.nativeElementIds.map((id) =>
            mapped(maps.nativeElements, id),
          ),
        }
      : {}),
    ...(diagram.nativeRelationshipIds
      ? {
          nativeRelationshipIds: diagram.nativeRelationshipIds.map((id) =>
            mapped(maps.nativeRelationships, id),
          ),
        }
      : {}),
    elements: diagram.elements.map(remapElement),
  };
}

export function duplicateDiagram(
  project: Project,
  diagramId: string,
  name?: string,
): Project {
  const original = project.diagrams.find((diagram) => diagram.id === diagramId);
  if (!original) throw new Error('Diagram not found.');
  if (project.diagrams.length >= 100)
    throw new Error('A project can contain at most 100 diagrams.');
  const id = uid();
  const diagram = copyDiagram(original, id, {
    classes: new Map(),
    relationships: new Map(),
    files: new Map(),
    nativeElements: new Map(),
    nativeRelationships: new Map(),
  });
  diagram.name = name ?? `${original.name} copy`;
  return {
    ...project,
    activeDiagramId: id,
    diagrams: [...project.diagrams, diagram],
  };
}

export function mergeProjects(current: Project, incoming: Project): Project {
  // Check both boundaries before copying; no caller-owned object is mutated on failure.
  const source = parseProject(JSON.stringify(incoming));
  parseProject(JSON.stringify(current));
  if (
    current.classes.length + source.classes.length > 2000 ||
    current.relationships.length + source.relationships.length > 20000 ||
    current.diagrams.length + source.diagrams.length > 100
  )
    throw new Error(
      'Merging would exceed the project limit of 2000 classifiers, 20000 relationships or 100 diagrams.',
    );
  if (
    (current.nativeModel?.elements.length ?? 0) +
      (source.nativeModel?.elements.length ?? 0) >
      10000 ||
    (current.nativeModel?.relationships.length ?? 0) +
      (source.nativeModel?.relationships.length ?? 0) >
      20000
  )
    throw new Error('Merging would exceed the native UML model limit.');
  const maps: IdMaps = {
    classes: new Map(source.classes.map((item) => [item.id, uid()])),
    relationships: new Map(
      source.relationships.map((item) => [item.id, uid()]),
    ),
    files: new Map(Object.keys(source.files).map((id) => [id, uid()])),
    nativeElements: new Map(
      source.nativeModel?.elements.map((item) => [item.id, uid()]),
    ),
    nativeRelationships: new Map(
      source.nativeModel?.relationships.map((item) => [item.id, uid()]),
    ),
  };
  // Seeds can be saved before their first reconciliation. Give unknown stamps
  // fresh identity too, with one mapping shared across all incoming diagrams.
  for (const diagram of source.diagrams)
    for (const element of diagram.elements) {
      const metadata = element.customData?.uml;
      if (
        !isNativeUmlMetadata(metadata) ||
        maps.nativeElements.has(metadata.id) ||
        maps.nativeRelationships.has(metadata.id)
      )
        continue;
      const map = isNativeRelationshipKind(metadata.kind)
        ? maps.nativeRelationships
        : maps.nativeElements;
      map.set(metadata.id, uid());
    }
  const diagrams = source.diagrams.map((diagram) =>
    copyDiagram(diagram, uid(), maps),
  );
  const files = Object.fromEntries(
    Object.entries(source.files).map(([id, file]) => {
      const newId = mapped(maps.files, id);
      return [
        newId,
        isRecord(file)
          ? { ...structuredClone(file), id: newId }
          : structuredClone(file),
      ];
    }),
  );
  const result: Project = {
    ...current,
    classes: [
      ...current.classes,
      ...source.classes.map((item) => ({
        ...item,
        id: mapped(maps.classes, item.id),
      })),
    ],
    relationships: [
      ...current.relationships,
      ...source.relationships.map((item) => ({
        ...item,
        id: mapped(maps.relationships, item.id),
        from: mapped(maps.classes, item.from),
        to: mapped(maps.classes, item.to),
      })),
    ],
    diagrams: [...current.diagrams, ...diagrams],
    activeDiagramId: diagrams[0].id,
    files: { ...current.files, ...files },
    ...(current.nativeModel || source.nativeModel
      ? {
          nativeModel: {
            elements: [
              ...(current.nativeModel?.elements ?? []),
              ...(source.nativeModel?.elements ?? []).map((item) => ({
                ...item,
                id: mapped(maps.nativeElements, item.id),
              })),
            ],
            relationships: [
              ...(current.nativeModel?.relationships ?? []),
              ...(source.nativeModel?.relationships ?? []).map((item) => ({
                ...item,
                id: mapped(maps.nativeRelationships, item.id),
                from: mapped(maps.nativeElements, item.from),
                to: mapped(maps.nativeElements, item.to),
              })),
            ],
          },
        }
      : {}),
  };
  return parseProject(JSON.stringify(result));
}
