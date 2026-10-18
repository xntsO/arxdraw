import { courseLab } from './course-labs.ts';
import { nativeBlueprint } from './course-builders.ts';
import type { CourseBlueprint } from './course-builders.ts';
import { courseClassExample } from './course-class-examples.ts';
import { interactionExample } from './course-interaction-examples.ts';
import { structureExample } from './course-structure-examples.ts';
import { dfdExample } from './course-dfd-examples.ts';

export type CourseLabMode = 'blank' | 'example';

/** Pure construction; browser text measurement happens in course-runtime.ts. */
export function courseLabBlueprint(
  id: string,
  mode: CourseLabMode,
): CourseBlueprint {
  const lab = courseLab(id);
  if (lab.kind === 'class') {
    const blueprint = courseClassExample(lab, mode === 'blank');
    blueprint.project.diagrams = blueprint.project.diagrams.map((diagram) => ({
      ...diagram,
      labId: id,
    }));
    return blueprint;
  }
  const title = `${lab.number}. ${lab.title}`;
  const diagrams =
    lab.kind === 'data-flow'
      ? dfdExample(lab.number)
      : [
          {
            name: title,
            elements:
              lab.kind === 'use-case' || lab.kind === 'sequence'
                ? interactionExample(lab.number)
                : structureExample(lab.number),
          },
        ];
  const blueprint = nativeBlueprint(
    title,
    lab.kind,
    diagrams,
    mode === 'blank',
  );
  blueprint.project.diagrams = blueprint.project.diagrams.map((diagram) => ({
    ...diagram,
    labId: id,
  }));
  return blueprint;
}
