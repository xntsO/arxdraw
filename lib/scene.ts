import {
  convertToExcalidrawElements,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Diagram, Project, SceneElement } from './model';
import { nativeUmlMetadata } from './native-model';

import { diagramSkeletons } from './diagram';
import { repairSceneBindings } from './bindings';

/** Measure renamed native text in the browser, including inactive diagrams. */
function refreshNativeLabels(
  project: Project,
  diagram: Diagram,
  scene: SceneElement[],
): SceneElement[] {
  if (!project.nativeModel) return scene;
  const relationships = new Map(
    project.nativeModel.relationships.map((relationship) => [
      relationship.id,
      relationship,
    ]),
  );
  const existingLabels = new Set(
    scene
      .filter(
        (element) =>
          !element.isDeleted &&
          element.type === 'text' &&
          typeof element.containerId === 'string',
      )
      .map((element) => element.containerId),
  );
  const additions: ExcalidrawElementSkeleton[] = [];
  const refreshIds = new Set(
    scene
      .filter((element) => element.customData?.umlNeedsMeasure === true)
      .map((element) => element.id),
  );
  for (const element of scene) {
    const metadata = nativeUmlMetadata(element);
    if (
      element.isDeleted ||
      element.type !== 'arrow' ||
      metadata?.role !== 'edge' ||
      existingLabels.has(element.id)
    )
      continue;
    const relationship = relationships.get(metadata.id);
    if (!relationship?.name) continue;
    const id = `native-label-${diagram.id}-${relationship.id}`;
    additions.push({
      id,
      type: 'text',
      x: element.x + element.width / 2,
      y: element.y + element.height / 2,
      text: relationship.name,
      fontSize: 15,
      fontFamily: 2,
      containerId: element.id,
      textAlign: 'center',
      verticalAlign: 'middle',
      customData: {
        uml: {
          id: relationship.id,
          kind: relationship.kind,
          role: 'name',
          name: relationship.name,
        },
      },
    });
    refreshIds.add(id);
  }
  if (!refreshIds.size) return scene;
  const all: SceneElement[] = [
    ...scene,
    ...convertToExcalidrawElements(additions, { regenerateIds: false }),
  ];
  const containerIds = new Set(
    all
      .filter((element) => refreshIds.has(element.id))
      .map((element) => element.containerId),
  );
  // Restore works on copies. Keep freehand elements and native geometry that do
  // not contain an edited label exactly as they were.
  const restored = new Map(
    restoreElements(structuredClone(all) as ExcalidrawElement[], null, {
      refreshDimensions: true,
      repairBindings: true,
    }).map((element) => [element.id, element]),
  );
  const refreshed: SceneElement[] = all.map((element) => {
    if (!refreshIds.has(element.id) && !containerIds.has(element.id))
      return element;
    const measured = restored.get(element.id);
    if (!measured) return element;
    const customData: Record<string, unknown> = { ...measured.customData };
    delete customData.umlNeedsMeasure;
    return { ...measured, customData };
  });
  for (const header of refreshed) {
    const metadata = nativeUmlMetadata(header);
    if (
      !refreshIds.has(header.id) ||
      header.type !== 'text' ||
      metadata?.kind !== 'object' ||
      metadata.role !== 'name'
    )
      continue;
    const node = refreshed.find(
      (element) =>
        nativeUmlMetadata(element)?.id === metadata.id &&
        nativeUmlMetadata(element)?.role === 'node' &&
        (!metadata.viewId || metadata.viewId === element.id),
    );
    if (!node) continue;
    const underline = refreshed.find(
      (element) =>
        element.type === 'line' &&
        nativeUmlMetadata(element)?.id === metadata.id &&
        Math.abs(element.x - header.x) < 2 &&
        element.y > header.y,
    );
    if (!underline) continue;
    const updated = {
      ...underline,
      x: header.x,
      y: header.y + header.height + 2,
      width: header.width,
      height: 0,
      points: [
        [0, 0],
        [header.width, 0],
      ],
      version:
        typeof underline.version === 'number' ? underline.version + 1 : 1,
    };
    refreshed[refreshed.findIndex((element) => element.id === underline.id)] =
      updated;
    const width = Math.max(node.width, header.width + 28);
    const dividerIndex = refreshed.findIndex(
      (element) =>
        element.type === 'line' &&
        nativeUmlMetadata(element)?.id === metadata.id &&
        element.x === node.x &&
        element.y > header.y,
    );
    const divider = refreshed[dividerIndex];
    const verticalGrowth = divider ? Math.max(0, updated.y + 8 - divider.y) : 0;
    if (width !== node.width || verticalGrowth) {
      refreshed[refreshed.findIndex((element) => element.id === node.id)] = {
        ...node,
        width,
        height: node.height + verticalGrowth,
        version: typeof node.version === 'number' ? node.version + 1 : 1,
      };
      if (divider)
        refreshed[dividerIndex] = {
          ...divider,
          width,
          y: divider.y + verticalGrowth,
          points: [
            [0, 0],
            [width, 0],
          ],
          version:
            typeof divider.version === 'number' ? divider.version + 1 : 1,
        };
      if (divider && verticalGrowth)
        for (let index = 0; index < refreshed.length; index++) {
          const element = refreshed[index];
          if (
            element.type === 'text' &&
            nativeUmlMetadata(element)?.id === metadata.id &&
            nativeUmlMetadata(element)?.role === 'decor' &&
            element.y >= divider.y
          )
            refreshed[index] = {
              ...element,
              y: element.y + verticalGrowth,
              version:
                typeof element.version === 'number' ? element.version + 1 : 1,
            };
        }
    }
  }
  return refreshed;
}

export function renderDiagram(p: Project, d: Diagram): Diagram {
  const raw = diagramSkeletons(p, d);
  const generated = convertToExcalidrawElements(
    raw as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  );
  const generatedIds = new Set(generated.map((e) => e.id));
  // Label elements created by the Excalidraw converter belong to the UML relationship, too.
  const elements = generated.map((e) => ({
    ...e,
    customData: { ...e.customData, arxdraw: true },
  }));
  const freehand = d.elements.filter(
    (e) => !e.customData?.arxdraw && !generatedIds.has(e.id),
  );
  return {
    ...d,
    elements: repairSceneBindings(
      refreshNativeLabels(p, d, [...elements, ...freehand]),
    ),
  };
}
export function renderProject(p: Project): Project {
  return { ...p, diagrams: p.diagrams.map((d) => renderDiagram(p, d)) };
}
