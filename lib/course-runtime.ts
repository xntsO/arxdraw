import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { Project } from './model';
import { courseLabBlueprint } from './course-blueprint';
import type { CourseLabMode } from './course-blueprint';
import { reconcileNativeUmlScene } from './native-model';
import { renderProject } from './scene';

/** Run after the editor's fonts load, using Excalidraw's real converter. */
export function createCourseLab(id: string, mode: CourseLabMode): Project {
  const blueprint = courseLabBlueprint(id, mode);
  const scenes = new Map(
    blueprint.scenes.map((scene) => [scene.diagramId, scene.skeletons]),
  );
  let project = {
    ...blueprint.project,
    diagrams: blueprint.project.diagrams.map((diagram) => ({
      ...diagram,
      // PracticeSkeleton is the existing notation-builder input. Excalidraw's
      // discriminated union cannot express its optional factory properties.
      elements: scenes.has(diagram.id)
        ? convertToExcalidrawElements(
            (scenes.get(diagram.id) ?? []) as ExcalidrawElementSkeleton[],
            { regenerateIds: false },
          )
        : diagram.elements,
    })),
  };
  for (const diagram of project.diagrams)
    project = reconcileNativeUmlScene(project, diagram.id);
  return renderProject(project);
}
