import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { Diagram, Project } from './model';

import { diagramSkeletons } from './diagram';

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
  return { ...d, elements: [...elements, ...freehand] };
}
export function renderProject(p: Project): Project {
  return { ...p, diagrams: p.diagrams.map((d) => renderDiagram(p, d)) };
}
