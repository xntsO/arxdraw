import type {
  Classifier,
  Diagram,
  Project,
  Relationship,
  SceneElement,
} from './model.ts';
import {
  isNativeElementKind,
  isNativeRelationshipKind,
  isNativeUmlMetadata,
} from './native-model-types.ts';
import type { NativeUmlModel } from './native-model-types.ts';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(nonempty);
const unique = (values: string[]) => new Set(values).size === values.length;
const hasStrings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string');
function isClassifier(value: unknown): value is Classifier {
  return (
    isRecord(value) &&
    nonempty(value.id) &&
    hasStrings(value, ['name', 'attributes', 'operations', 'description']) &&
    typeof value.kind === 'string' &&
    ['class', 'interface', 'abstract'].includes(value.kind)
  );
}
function isRelationship(value: unknown): value is Relationship {
  return (
    isRecord(value) &&
    nonempty(value.id) &&
    nonempty(value.from) &&
    nonempty(value.to) &&
    hasStrings(value, ['label', 'sourceMultiplicity', 'targetMultiplicity']) &&
    typeof value.kind === 'string' &&
    (value.navigable === undefined || value.navigable === 'target') &&
    [
      'association',
      'aggregation',
      'composition',
      'inheritance',
      'dependency',
      'realization',
    ].includes(value.kind)
  );
}
function isSceneElement(value: unknown): value is SceneElement {
  if (
    !isRecord(value) ||
    !nonempty(value.id) ||
    !nonempty(value.type) ||
    ![value.x, value.y, value.width, value.height].every(finite)
  )
    return false;
  if (value.isDeleted !== undefined && typeof value.isDeleted !== 'boolean')
    return false;
  if (value.customData !== undefined) {
    if (!isRecord(value.customData)) return false;
    for (const key of ['modelId', 'relationshipId', 'role'])
      if (
        value.customData[key] !== undefined &&
        typeof value.customData[key] !== 'string'
      )
        return false;
    if (
      value.customData.arxdraw !== undefined &&
      typeof value.customData.arxdraw !== 'boolean'
    )
      return false;
    if (
      value.customData.uml !== undefined &&
      !isNativeUmlMetadata(value.customData.uml)
    )
      return false;
  }
  for (const key of ['groupIds'])
    if (value[key] !== undefined && !strings(value[key])) return false;
  for (const key of ['containerId', 'frameId', 'fileId'])
    if (
      value[key] !== undefined &&
      value[key] !== null &&
      !nonempty(value[key])
    )
      return false;
  for (const key of ['startBinding', 'endBinding']) {
    const binding = value[key];
    if (
      binding !== undefined &&
      binding !== null &&
      (!isRecord(binding) || !nonempty(binding.elementId))
    )
      return false;
  }
  for (const key of ['start', 'end']) {
    const binding = value[key];
    if (
      binding !== undefined &&
      binding !== null &&
      (!isRecord(binding) || !nonempty(binding.id))
    )
      return false;
  }
  if (
    value.boundElements !== undefined &&
    value.boundElements !== null &&
    (!Array.isArray(value.boundElements) ||
      !value.boundElements.every(
        (bound) =>
          isRecord(bound) && nonempty(bound.id) && nonempty(bound.type),
      ))
  )
    return false;
  if (
    value.points !== undefined &&
    (!Array.isArray(value.points) ||
      !value.points.every(
        (point) =>
          Array.isArray(point) && point.length === 2 && point.every(finite),
      ))
  )
    return false;
  return true;
}
function isDiagram(value: unknown): value is Diagram {
  if (
    !isRecord(value) ||
    !nonempty(value.id) ||
    typeof value.name !== 'string' ||
    !strings(value.classIds) ||
    !unique(value.classIds) ||
    !strings(value.relationshipIds) ||
    !unique(value.relationshipIds) ||
    !Array.isArray(value.elements) ||
    value.elements.length > 20000 ||
    !value.elements.every(isSceneElement) ||
    !unique(value.elements.map((element) => element.id))
  )
    return false;
  for (const key of ['nativeElementIds', 'nativeRelationshipIds'])
    if (
      value[key] !== undefined &&
      (!strings(value[key]) || !unique(value[key]))
    )
      return false;
  if (
    value.kind !== undefined &&
    (typeof value.kind !== 'string' ||
      ![
        'class',
        'use-case',
        'sequence',
        'activity',
        'state',
        'component',
        'deployment',
        'object',
        'package',
        'data-flow',
        'communication',
      ].includes(value.kind))
  )
    return false;
  if (value.viewport !== undefined) {
    const viewport = value.viewport;
    if (
      !isRecord(viewport) ||
      !finite(viewport.scrollX) ||
      !finite(viewport.scrollY) ||
      !isRecord(viewport.zoom) ||
      !finite(viewport.zoom.value) ||
      viewport.zoom.value <= 0 ||
      viewport.zoom.value > 30 ||
      typeof viewport.viewBackgroundColor !== 'string'
    )
      return false;
  }
  return true;
}

function isNativeModel(value: unknown): value is NativeUmlModel {
  if (
    !isRecord(value) ||
    !Array.isArray(value.elements) ||
    value.elements.length > 10000 ||
    !Array.isArray(value.relationships) ||
    value.relationships.length > 20000
  )
    return false;
  return (
    value.elements.every(
      (item) =>
        isRecord(item) &&
        nonempty(item.id) &&
        isNativeElementKind(item.kind) &&
        hasStrings(item, ['name', 'description']),
    ) &&
    value.relationships.every(
      (item) =>
        isRecord(item) &&
        nonempty(item.id) &&
        isNativeRelationshipKind(item.kind) &&
        nonempty(item.from) &&
        nonempty(item.to) &&
        hasStrings(item, ['name', 'description']),
    )
  );
}

// JSON is unknown until every field consumed by the model/scene code is checked.
// Additional Excalidraw properties and v1 extension fields remain intact.
export function parseProject(raw: string): Project {
  if (raw.length > 40_000_000)
    throw new Error('This project is too large (40 MB maximum).');
  const value: unknown = JSON.parse(raw);
  // A pasted extension stamp is optional metadata, not the drawing itself.
  // Drop malformed native stamps while keeping the user's geometry and text.
  if (isRecord(value) && Array.isArray(value.diagrams))
    for (const diagram of value.diagrams) {
      if (!isRecord(diagram)) continue;
      if (
        diagram.labId !== undefined &&
        (typeof diagram.labId !== 'string' ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(diagram.labId))
      )
        delete diagram.labId;
      if (!Array.isArray(diagram.elements)) continue;
      for (const element of diagram.elements) {
        if (!isRecord(element) || !isRecord(element.customData)) continue;
        if (
          element.customData.uml !== undefined &&
          !isNativeUmlMetadata(element.customData.uml)
        )
          delete element.customData.uml;
      }
    }
  const fail = (): never => {
    throw new Error('This is not a valid ArxDraw v1 project.');
  };
  if (
    !isRecord(value) ||
    value.format !== 'arxdraw' ||
    value.version !== 1 ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.classes) ||
    value.classes.length > 2000 ||
    !value.classes.every(isClassifier) ||
    !unique(value.classes.map((item) => item.id)) ||
    !Array.isArray(value.relationships) ||
    value.relationships.length > 20000 ||
    !value.relationships.every(isRelationship) ||
    !unique(value.relationships.map((item) => item.id)) ||
    !Array.isArray(value.diagrams) ||
    !value.diagrams.length ||
    value.diagrams.length > 100 ||
    !value.diagrams.every(isDiagram) ||
    !unique(value.diagrams.map((item) => item.id)) ||
    !nonempty(value.activeDiagramId) ||
    !isRecord(value.files)
  )
    return fail();
  if (value.nativeModel !== undefined && !isNativeModel(value.nativeModel))
    return fail();
  const nativeModel = value.nativeModel;
  const nativeElementIds = new Set(
    nativeModel?.elements.map((item) => item.id),
  );
  const nativeRelationshipIds = new Set(
    nativeModel?.relationships.map((item) => item.id),
  );
  if (
    nativeModel &&
    (nativeElementIds.size !== nativeModel.elements.length ||
      nativeRelationshipIds.size !== nativeModel.relationships.length ||
      nativeModel.relationships.some(
        (item) =>
          nativeElementIds.has(item.id) ||
          !nativeElementIds.has(item.from) ||
          !nativeElementIds.has(item.to),
      ))
  )
    return fail();
  if (
    value.diagrams.some(
      (diagram) =>
        diagram.nativeElementIds?.some((id) => !nativeElementIds.has(id)) ||
        diagram.nativeRelationshipIds?.some(
          (id) => !nativeRelationshipIds.has(id),
        ),
    )
  )
    return fail();
  const classIds = new Set(value.classes.map((item) => item.id));
  const relationshipIds = new Set(value.relationships.map((item) => item.id));
  if (
    value.relationships.some(
      (item) => !classIds.has(item.from) || !classIds.has(item.to),
    ) ||
    value.diagrams.some(
      (item) =>
        item.classIds.some((id) => !classIds.has(id)) ||
        item.relationshipIds.some((id) => !relationshipIds.has(id)),
    ) ||
    !value.diagrams.some((item) => item.id === value.activeDiagramId)
  )
    return fail();
  return {
    ...value,
    format: 'arxdraw',
    version: 1,
    name: value.name,
    classes: value.classes,
    relationships: value.relationships,
    diagrams: value.diagrams,
    activeDiagramId: value.activeDiagramId,
    files: value.files,
  };
}
