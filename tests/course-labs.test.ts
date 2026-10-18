import test from 'node:test';
import assert from 'node:assert/strict';
import { courseLabs } from '../lib/course-labs.ts';
import { courseLabBlueprint } from '../lib/course-blueprint.ts';
import { parseProject, projectDiagnostics } from '../lib/model.ts';
import { isNativeUmlMetadata } from '../lib/native-model-types.ts';

void test('course catalog covers every numbered and additional manual exercise', () => {
  assert.equal(courseLabs.length, 37);
  assert.equal(new Set(courseLabs.map((lab) => lab.id)).size, 37);
  assert.equal(courseLabs.filter((lab) => lab.practice).length, 8);
  assert.deepEqual(
    courseLabs
      .filter((lab) => !lab.practice)
      .map((lab) => Number(lab.number))
      .sort((a, b) => a - b),
    Array.from({ length: 30 }, (_, i) => i + 1).filter((n) => n !== 13),
  );
  assert.ok(
    courseLabs.every(
      (lab) => lab.page >= 4 && lab.page <= 38 && lab.checklist.length >= 3,
    ),
  );
});

void test('all43 worked diagrams construct with valid endpoints and fresh identifiers', () => {
  let count = 0;
  for (const lab of courseLabs) {
    const example = courseLabBlueprint(lab.id, 'example');
    const another = courseLabBlueprint(lab.id, 'example');
    assert.notEqual(
      example.project.activeDiagramId,
      another.project.activeDiagramId,
    );
    count += example.project.diagrams.length;
    for (const scene of example.scenes) {
      assert.ok(scene.skeletons.length > 0, lab.id);
      const ids = new Set(scene.skeletons.map((item) => item.id));
      assert.equal(ids.size, scene.skeletons.length, lab.id);
      for (const element of scene.skeletons) {
        if (element.start)
          assert.ok(ids.has(element.start.id), `${lab.id} dangling start`);
        if (element.end)
          assert.ok(ids.has(element.end.id), `${lab.id} dangling end`);
      }
    }
    if (lab.kind === 'class') {
      const parsed = parseProject(JSON.stringify(example.project));
      assert.deepEqual(projectDiagnostics(parsed), [], lab.id);
    }
  }
  assert.equal(count, 43);
});

void test('blank practice creates the matching kinds and three empty DFD levels', () => {
  for (const lab of courseLabs) {
    const { project, scenes } = courseLabBlueprint(lab.id, 'blank');
    assert.equal(project.diagrams.length, lab.kind === 'data-flow' ? 3 : 1);
    assert.ok(
      project.diagrams.every(
        (diagram) => diagram.kind === lab.kind && diagram.elements.length === 0,
      ),
    );
    assert.ok(scenes.every((scene) => scene.skeletons.length === 0));
    assert.equal(project.classes.length, 0);
    parseProject(JSON.stringify(project));
  }
});

void test('course examples exercise composition, slots, self calls and concurrent flow', () => {
  const building = courseLabBlueprint('comp371-6', 'example').project;
  assert.equal(
    building.relationships.filter((link) => link.kind === 'inheritance').length,
    4,
  );
  assert.ok(building.relationships.some((link) => link.kind === 'composition'));
  assert.ok(building.relationships.some((link) => link.kind === 'aggregation'));
  const objects = courseLabBlueprint('comp371-9', 'example').scenes.flatMap(
    (scene) => scene.skeletons,
  );
  assert.ok(objects.some((item) => item.text?.includes('amount = 500')));
  const payment = courseLabBlueprint('comp371-14', 'example').scenes.flatMap(
    (scene) => scene.skeletons,
  );
  assert.ok(
    payment.some(
      (item) =>
        item.type === 'arrow' &&
        item.start?.id === item.end?.id &&
        (item.points?.length ?? 0) >= 4,
    ),
  );
  const workflow = courseLabBlueprint('comp371-20', 'example').scenes.flatMap(
    (scene) => scene.skeletons,
  );
  const forks = workflow.filter((item) => {
    const data = item.customData;
    return (
      data &&
      typeof data === 'object' &&
      'uml' in data &&
      isNativeUmlMetadata(data.uml) &&
      data.uml.role === 'node' &&
      data.uml.kind === 'fork'
    );
  });
  assert.equal(forks.length, 2);
});
