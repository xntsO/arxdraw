import { uid } from './model.ts';
import type { Diagram, Project, SceneElement } from './model.ts';
import {
  isNativeElementKind,
  isNativeRelationshipKind,
  isNativeUmlMetadata,
} from './native-model-types.ts';
import type {
  NativeRelationshipKind,
  NativeUmlElement,
  NativeUmlMetadata,
  NativeUmlRelationship,
} from './native-model-types.ts';
import { symbolSkeletons } from './practice.ts';
import type { PracticeSkeleton } from './practice.ts';
import { isRecord } from './project-parse.ts';
import { repairSceneBindings } from './bindings.ts';

export function nativeUmlMetadata(
  element: SceneElement,
): NativeUmlMetadata | undefined {
  const value = element.customData?.uml;
  return isNativeUmlMetadata(value) ? value : undefined;
}
function annotate(
  element: SceneElement,
  metadata: NativeUmlMetadata,
): SceneElement {
  if (JSON.stringify(element.customData?.uml) === JSON.stringify(metadata))
    return element;
  return { ...element, customData: { ...element.customData, uml: metadata } };
}
const groups = (element: SceneElement): string[] =>
  Array.isArray(element.groupIds)
    ? element.groupIds.filter(
        (group): group is string => typeof group === 'string',
      )
    : [];
function binding(
  element: SceneElement,
  key: 'startBinding' | 'endBinding',
): string | undefined {
  const value = element[key];
  if (isRecord(value) && typeof value.elementId === 'string')
    return value.elementId;
  const skeleton = element[key === 'startBinding' ? 'start' : 'end'];
  return isRecord(skeleton) && typeof skeleton.id === 'string'
    ? skeleton.id
    : undefined;
}
function defaultConnector(diagram: Diagram): NativeRelationshipKind {
  switch (diagram.kind) {
    case 'activity':
      return 'flow';
    case 'state':
      return 'transition';
    case 'sequence':
      return 'message';
    case 'data-flow':
      return 'data-flow';
    case 'communication':
      return 'numbered-message';
    case 'component':
    case 'package':
      return 'dependency';
    case 'deployment':
      return 'communication-path';
    case 'object':
      return 'link';
    default:
      return 'association';
  }
}
const displayName = (name: string, metadata: NativeUmlMetadata) =>
  `${metadata.labelPrefix ?? ''}${name}${metadata.labelSuffix ?? ''}`;
const originalText = (element: SceneElement): string | undefined =>
  typeof element.originalText === 'string'
    ? element.originalText
    : typeof element.text === 'string'
      ? element.text
      : undefined;
function semanticName(text: string, metadata: NativeUmlMetadata): string {
  let value = text;
  if (metadata.labelPrefix && value.startsWith(metadata.labelPrefix))
    value = value.slice(metadata.labelPrefix.length);
  if (metadata.labelSuffix && value.endsWith(metadata.labelSuffix))
    value = value.slice(0, -metadata.labelSuffix.length);
  return value;
}
function namedScenes(project: Project): Project {
  if (!project.nativeModel) return project;
  const names = new Map(
    [...project.nativeModel.elements, ...project.nativeModel.relationships].map(
      (item) => [item.id, item.name],
    ),
  );
  let changed = false;
  const diagrams = project.diagrams.map((diagram) => {
    let diagramChanged = false;
    const elements = diagram.elements.map((element) => {
      const metadata = nativeUmlMetadata(element),
        name = metadata && names.get(metadata.id);
      if (!metadata || name === undefined) return element;
      let next = annotate(element, { ...metadata, name });
      if (metadata.role === 'name' && element.type === 'text') {
        const text = displayName(name, metadata);
        if (originalText(element) !== text) {
          const version =
            typeof element.version === 'number' ? element.version + 1 : 1;
          next = {
            ...next,
            text,
            originalText: text,
            version,
            customData: { ...next.customData, umlNeedsMeasure: true },
          };
        }
      }
      if (next !== element) diagramChanged = true;
      return next;
    });
    if (!diagramChanged) return diagram;
    changed = true;
    return { ...diagram, elements };
  });
  return changed ? { ...project, diagrams } : project;
}

export function reconcileNativeUmlScene(
  project: Project,
  diagramId: string,
  options: {
    connectorKind?: NativeRelationshipKind;
    editingText?: boolean;
  } = {},
): Project {
  const diagram = project.diagrams.find((item) => item.id === diagramId);
  if (!diagram) return project;
  const oldModel = project.nativeModel ?? { elements: [], relationships: [] };
  const models = [...oldModel.elements],
    relationships = [...oldModel.relationships];
  const byId = new Map(models.map((item) => [item.id, item]));
  let changed = false;
  let scene = diagram.elements;
  const nodes = new Map<string, SceneElement[]>();
  for (const element of scene) {
    const metadata = nativeUmlMetadata(element);
    if (
      !element.isDeleted &&
      metadata?.role === 'node' &&
      isNativeElementKind(metadata.kind)
    )
      nodes.set(metadata.id, [...(nodes.get(metadata.id) ?? []), element]);
  }
  const replacements = new Map<string, NativeUmlMetadata>();
  for (const [id, views] of nodes) {
    const original =
      views.find((view) => nativeUmlMetadata(view)?.viewId === view.id) ??
      views[0];
    const metadata = nativeUmlMetadata(original);
    if (!metadata || !isNativeElementKind(metadata.kind)) continue;
    let existing = byId.get(id);
    if (!existing) {
      if (models.length >= 10000)
        throw new Error(
          'A project can contain at most 10000 native UML elements.',
        );
      existing = {
        id,
        kind: metadata.kind,
        name: metadata.name ?? metadata.kind,
        description: '',
      };
      models.push(existing);
      byId.set(id, existing);
      changed = true;
    }
    for (const copy of views.filter((view) => view !== original)) {
      if (models.length >= 10000)
        throw new Error(
          'A project can contain at most 10000 native UML elements.',
        );
      const copyId = uid();
      let suffix = 2,
        name = `${existing.name} ${suffix}`;
      while (models.some((item) => item.name === name))
        name = `${existing.name} ${++suffix}`;
      const cloned = { ...existing, id: copyId, name };
      models.push(cloned);
      byId.set(copyId, cloned);
      const otherGroups = new Set(
        views.filter((view) => view !== copy).flatMap(groups),
      );
      const ownGroups = new Set(
        groups(copy).filter((group) => !otherGroups.has(group)),
      );
      for (const part of scene) {
        const meta = nativeUmlMetadata(part);
        if (
          meta?.id === id &&
          (part === copy || groups(part).some((group) => ownGroups.has(group)))
        )
          replacements.set(part.id, {
            ...meta,
            id: copyId,
            name,
            viewId: copy.id,
          });
      }
      changed = true;
    }
  }
  // Bound text is part of the copied view even when the symbol has no group.
  for (const element of scene) {
    const parent =
      typeof element.containerId === 'string'
        ? replacements.get(element.containerId)
        : undefined;
    if (element.type === 'text' && parent)
      replacements.set(element.id, {
        ...(nativeUmlMetadata(element) ?? parent),
        id: parent.id,
        role: 'name',
        name: parent.name,
        viewId: parent.viewId,
      });
  }
  if (replacements.size)
    scene = scene.map((element) => {
      const metadata = replacements.get(element.id);
      if (!metadata) return element;
      const next = annotate(element, metadata);
      return metadata.role === 'name'
        ? {
            ...next,
            text: displayName(metadata.name ?? '', metadata),
            originalText: displayName(metadata.name ?? '', metadata),
            customData: { ...next.customData, umlNeedsMeasure: true },
          }
        : next;
    });
  const sceneById = new Map(scene.map((element) => [element.id, element]));
  // Excalidraw creates bound text after converting a skeleton. Adopt only text
  // whose container already carries a UML seed, never arbitrary legacy shapes.
  scene = scene.map((element) => {
    if (
      element.isDeleted ||
      element.type !== 'text' ||
      typeof element.containerId !== 'string'
    )
      return element;
    const container = sceneById.get(element.containerId),
      meta = container && nativeUmlMetadata(container);
    if (
      !meta ||
      meta.name === undefined ||
      typeof element.text !== 'string' ||
      (nativeUmlMetadata(element) && !replacements.has(container?.id ?? ''))
    )
      return element;
    changed = true;
    const next = annotate(element, { ...meta, role: 'name' });
    return replacements.has(container?.id ?? '')
      ? {
          ...next,
          text: displayName(meta.name, meta),
          originalText: displayName(meta.name, meta),
          customData: { ...next.customData, umlNeedsMeasure: true },
        }
      : next;
  });
  const nativeElementIds = [
    ...new Set(
      scene
        .filter(
          (element) =>
            !element.isDeleted && nativeUmlMetadata(element)?.role === 'node',
        )
        .map((element) => nativeUmlMetadata(element)?.id)
        .filter((id): id is string => !!id && byId.has(id)),
    ),
  ];
  const viewIds = new Set(nativeElementIds);
  const liveById = new Map(
    scene
      .filter((element) => !element.isDeleted)
      .map((element) => [element.id, element]),
  );
  const relationMap = new Map(relationships.map((item) => [item.id, item]));
  const primaryEdges = new Map<string, string>();
  for (const arrow of scene) {
    const metadata = nativeUmlMetadata(arrow);
    if (arrow.isDeleted || arrow.type !== 'arrow' || metadata?.role !== 'edge')
      continue;
    if (!primaryEdges.has(metadata.id) || metadata.viewId === arrow.id)
      primaryEdges.set(metadata.id, arrow.id);
  }
  const seenRelationships = new Set<string>(),
    nativeRelationshipIds: string[] = [];
  const edgeLabels = new Map<string, string>();
  const reroutedLabels = new Set<string>();
  scene = scene.map((arrow) => {
    if (arrow.isDeleted || arrow.type !== 'arrow') return arrow;
    const sourceView = binding(arrow, 'startBinding'),
      targetView = binding(arrow, 'endBinding');
    const from = sourceView
      ? nativeUmlMetadata(liveById.get(sourceView) ?? arrow)?.id
      : undefined;
    const to = targetView
      ? nativeUmlMetadata(liveById.get(targetView) ?? arrow)?.id
      : undefined;
    if (!from || !to || !viewIds.has(from) || !viewIds.has(to)) return arrow;
    const metadata = nativeUmlMetadata(arrow);
    if (!metadata && !options.connectorKind) return arrow;
    if (metadata && metadata.role !== 'edge') return arrow;
    if (arrow.customData?.arxdraw) return arrow;
    const label = scene.find(
      (element) =>
        !element.isDeleted &&
        element.type === 'text' &&
        element.containerId === arrow.id,
    );
    const rawLabel =
      label && originalText(label) !== undefined
        ? (originalText(label) ?? '')
        : (metadata?.name ?? '');
    const kind =
      metadata && isNativeRelationshipKind(metadata.kind)
        ? metadata.kind
        : (options.connectorKind ?? defaultConnector(diagram));
    const previous = metadata ? relationMap.get(metadata.id) : undefined;
    const isCopy =
      previous &&
      (seenRelationships.has(previous.id) ||
        primaryEdges.get(previous.id) !== arrow.id ||
        (!diagram.nativeRelationshipIds?.includes(previous.id) &&
          (previous.from !== from || previous.to !== to)) ||
        ((previous.from !== from || previous.to !== to) &&
          project.diagrams.some(
            (other) =>
              other.id !== diagramId &&
              other.nativeRelationshipIds?.includes(previous.id),
          )));
    let relationship = previous;
    if (!relationship || isCopy) {
      if (relationships.length >= 20000)
        throw new Error(
          'A project can contain at most 20000 native UML relationships.',
        );
      relationship = previous
        ? { ...previous, id: uid(), from, to }
        : {
            id: metadata?.id ?? uid(),
            kind,
            from,
            to,
            name: rawLabel,
            description: '',
          };
      relationships.push(relationship);
      relationMap.set(relationship.id, relationship);
      changed = true;
    } else if (relationship.from !== from || relationship.to !== to) {
      relationship = { ...relationship, from, to };
      relationships[
        relationships.findIndex((item) => item.id === relationship?.id)
      ] = relationship;
      relationMap.set(relationship.id, relationship);
      changed = true;
    }
    seenRelationships.add(relationship.id);
    nativeRelationshipIds.push(relationship.id);
    if (label) edgeLabels.set(label.id, relationship.id);
    let annotated = annotate(arrow, {
      id: relationship.id,
      kind: relationship.kind,
      role: 'edge',
      name: relationship.name,
      viewId: arrow.id,
    });
    if (
      relationship.from === relationship.to &&
      [
        'message',
        'self-message',
        'async-message',
        'return',
        'numbered-message',
      ].includes(relationship.kind) &&
      (!Array.isArray(arrow.points) ||
        arrow.points.length < 4 ||
        arrow.width <= 0 ||
        arrow.height <= 0)
    ) {
      annotated = {
        ...annotated,
        points: [
          [0, 0],
          [90, 0],
          [90, 44],
          [0, 44],
        ],
        width: 90,
        height: 44,
        version: typeof arrow.version === 'number' ? arrow.version + 1 : 1,
      };
      if (label) reroutedLabels.add(label.id);
    }
    if (annotated !== arrow) changed = true;
    return annotated;
  });
  if (edgeLabels.size)
    scene = scene.map((element) => {
      const id = edgeLabels.get(element.id),
        relationship = id ? relationMap.get(id) : undefined;
      if (!relationship) return element;
      let annotated = annotate(element, {
        id: relationship.id,
        kind: relationship.kind,
        role: 'name',
        name: relationship.name,
      });
      if (reroutedLabels.has(element.id))
        annotated = {
          ...annotated,
          customData: { ...annotated.customData, umlNeedsMeasure: true },
        };
      if (annotated !== element) changed = true;
      return annotated;
    });
  if (!options.editingText) {
    for (const element of scene) {
      const metadata = nativeUmlMetadata(element);
      if (
        element.isDeleted ||
        element.type !== 'text' ||
        metadata?.role !== 'name' ||
        typeof element.text !== 'string'
      )
        continue;
      const name = semanticName(
        typeof element.originalText === 'string'
          ? element.originalText
          : element.text,
        metadata,
      );
      const model = byId.get(metadata.id),
        relationship = relationMap.get(metadata.id);
      if (model && model.name !== name) {
        const replacement = { ...model, name };
        models[models.findIndex((item) => item.id === model.id)] = replacement;
        byId.set(model.id, replacement);
        changed = true;
      } else if (relationship && relationship.name !== name) {
        const replacement = { ...relationship, name };
        relationships[
          relationships.findIndex((item) => item.id === relationship.id)
        ] = replacement;
        relationMap.set(relationship.id, replacement);
        changed = true;
      }
    }
  }
  if (
    JSON.stringify(diagram.nativeElementIds ?? []) !==
      JSON.stringify(nativeElementIds) ||
    JSON.stringify(diagram.nativeRelationshipIds ?? []) !==
      JSON.stringify(nativeRelationshipIds)
  )
    changed = true;
  if (!changed) return project;
  const next: Project = {
    ...project,
    nativeModel: { elements: models, relationships },
    diagrams: project.diagrams.map((item) =>
      item.id === diagramId
        ? { ...item, nativeElementIds, nativeRelationshipIds, elements: scene }
        : item,
    ),
  };
  return options.editingText ? next : namedScenes(next);
}

export function updateNativeUmlElement(
  project: Project,
  id: string,
  patch: Partial<Pick<NativeUmlElement, 'name' | 'description'>>,
): Project {
  if (!project.nativeModel?.elements.some((element) => element.id === id))
    return project;
  return namedScenes({
    ...project,
    nativeModel: {
      ...project.nativeModel,
      elements: project.nativeModel.elements.map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    },
  });
}
export function updateNativeUmlRelationship(
  project: Project,
  id: string,
  patch: Partial<Pick<NativeUmlRelationship, 'name' | 'description'>>,
): Project {
  if (
    !project.nativeModel?.relationships.some(
      (relationship) => relationship.id === id,
    )
  )
    return project;
  return namedScenes({
    ...project,
    nativeModel: {
      ...project.nativeModel,
      relationships: project.nativeModel.relationships.map((relationship) =>
        relationship.id === id ? { ...relationship, ...patch } : relationship,
      ),
    },
  });
}
function removeNativeViews(
  project: Project,
  diagramId: string,
  ids: Set<string>,
  globally: boolean,
): Project {
  return {
    ...project,
    diagrams: project.diagrams.map((diagram) => {
      if (!globally && diagram.id !== diagramId) return diagram;
      const removedViews = new Set(
        diagram.elements
          .filter((element) => {
            const metadata = nativeUmlMetadata(element);
            return metadata && ids.has(metadata.id);
          })
          .map((element) => element.id),
      );
      return {
        ...diagram,
        nativeElementIds: diagram.nativeElementIds?.filter(
          (id) => !ids.has(id),
        ),
        nativeRelationshipIds: diagram.nativeRelationshipIds?.filter(
          (id) => !ids.has(id),
        ),
        elements: repairSceneBindings(
          diagram.elements.filter(
            (element) =>
              !removedViews.has(element.id) &&
              !(
                typeof element.containerId === 'string' &&
                removedViews.has(element.containerId)
              ),
          ),
        ),
      };
    }),
  };
}
export function removeNativeUmlElement(
  project: Project,
  diagramId: string,
  id: string,
  deleteFromModel = false,
): Project {
  const model = project.nativeModel;
  if (!model?.elements.some((element) => element.id === id)) return project;
  const relationships = model.relationships.filter(
    (relationship) => relationship.from === id || relationship.to === id,
  );
  const ids = new Set([
    id,
    ...relationships.map((relationship) => relationship.id),
  ]);
  const next = removeNativeViews(project, diagramId, ids, deleteFromModel);
  return deleteFromModel
    ? {
        ...next,
        nativeModel: {
          elements: model.elements.filter((element) => element.id !== id),
          relationships: model.relationships.filter(
            (relationship) => !ids.has(relationship.id),
          ),
        },
      }
    : next;
}
export function removeNativeUmlRelationship(
  project: Project,
  diagramId: string,
  id: string,
  deleteFromModel = false,
): Project {
  if (
    !project.nativeModel?.relationships.some(
      (relationship) => relationship.id === id,
    )
  )
    return project;
  const next = removeNativeViews(
    project,
    diagramId,
    new Set([id]),
    deleteFromModel,
  );
  return deleteFromModel
    ? {
        ...next,
        nativeModel: {
          ...project.nativeModel,
          relationships: project.nativeModel.relationships.filter(
            (relationship) => relationship.id !== id,
          ),
        },
      }
    : next;
}
export function nativeUmlViewSkeletons(
  project: Project,
  id: string,
  x: number,
  y: number,
): PracticeSkeleton[] {
  const element = project.nativeModel?.elements.find((item) => item.id === id);
  if (!element) throw new Error('Native UML element not found.');
  return symbolSkeletons(element.kind, x, y, element.name).map((part) => {
    const metadata = part.customData;
    if (!isRecord(metadata) || !isNativeUmlMetadata(metadata.uml)) return part;
    return {
      ...part,
      customData: {
        ...metadata,
        uml: { ...metadata.uml, id: element.id, name: element.name },
      },
    };
  });
}
