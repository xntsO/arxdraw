import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  parseProject,
  updateClassifier,
  removeClassifier,
  projectIssues,
} from '../lib/model.ts';

void test('two diagrams reference one class and retain their independent views after editing', () => {
  const before = createProject();
  before.diagrams[0].elements = [
    { id: 'view1', type: 'rectangle', x: 10, y: 20, width: 200, height: 150 },
  ];
  before.diagrams[1].elements = [
    { id: 'view2', type: 'rectangle', x: 500, y: 800, width: 200, height: 150 },
  ];
  const after = updateClassifier(before, 'user', {
    name: 'Customer',
    attributes: '+ customerId: UUID',
  });
  assert.equal(after.classes.find((c) => c.id === 'user')?.name, 'Customer');
  assert.ok(after.diagrams.every((d) => d.classIds.includes('user')));
  assert.equal(before.classes.find((c) => c.id === 'user')?.name, 'User');
  assert.deepEqual(after.diagrams, before.diagrams);
});
void test('complete project round trip preserves diagrams, model, viewport, and embedded files', () => {
  const p = createProject();
  p.files = {
    example: {
      id: 'example',
      dataURL: 'data:image/png;base64,AA==',
      mimeType: 'image/png',
      created: 1,
    },
  };
  p.diagrams[1].viewport = {
    scrollX: -300,
    scrollY: 25,
    zoom: { value: 0.65 },
    viewBackgroundColor: '#fff',
  };
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
void test('deleting a model class removes every reference and incident relationship', () => {
  const p = removeClassifier(createProject(), 'order');
  assert.ok(!p.classes.some((c) => c.id === 'order'));
  assert.equal(p.relationships.length, 0);
  assert.ok(
    p.diagrams.every(
      (d) => !d.classIds.includes('order') && d.relationshipIds.length === 0,
    ),
  );
});
void test('import rejects missing references, duplicate IDs, invalid viewport, and unsupported versions', () => {
  const wrong = createProject();
  wrong.diagrams[0].classIds.push('missing');
  assert.throws(() => parseProject(JSON.stringify(wrong)));
  const duplicate = createProject();
  duplicate.classes.push(duplicate.classes[0]);
  assert.throws(() => parseProject(JSON.stringify(duplicate)));
  const viewport = createProject();
  viewport.diagrams[0].viewport = {
    scrollX: 0,
    scrollY: 0,
    zoom: { value: -1 },
    viewBackgroundColor: '#fff',
  };
  assert.throws(() => parseProject(JSON.stringify(viewport)));
  assert.throws(() => parseProject('{"format":"arxdraw","version":2}'));
});
void test('validation catches inheritance cycles, duplicate names, and invalid realization targets', () => {
  const p = createProject();
  p.classes[1].name = 'User';
  p.relationships = [
    { ...p.relationships[0], kind: 'inheritance', from: 'user', to: 'order' },
    { ...p.relationships[1], kind: 'inheritance', from: 'order', to: 'user' },
    { ...p.relationships[2], kind: 'realization', from: 'item', to: 'user' },
  ];
  const issues = projectIssues(p);
  assert.equal(issues.length, 3);
  assert.ok(issues.some((i) => i.includes('cycle')));
});

import { diagramSkeletons } from '../lib/diagram.ts';
void test('shared name changes update both diagrams while their box positions remain independent', () => {
  const p = createProject();
  p.diagrams[0].elements = [
    {
      id: 'a',
      x: 10,
      y: 20,
      width: 280,
      height: 200,
      type: 'rectangle',
      customData: { modelId: 'user', role: 'box' },
    },
  ];
  p.diagrams[1].elements = [
    {
      id: 'b',
      x: 450,
      y: 600,
      width: 310,
      height: 200,
      type: 'rectangle',
      customData: { modelId: 'user', role: 'box' },
    },
  ];
  const renamed = updateClassifier(p, 'user', { name: 'Customer' });
  const first = diagramSkeletons(renamed, renamed.diagrams[0]),
    second = diagramSkeletons(renamed, renamed.diagrams[1]);
  assert.equal(
    first.find(
      (e) => e.customData.modelId === 'user' && e.customData.role === 'name',
    )?.text,
    'Customer',
  );
  assert.equal(
    second.find(
      (e) => e.customData.modelId === 'user' && e.customData.role === 'name',
    )?.text,
    'Customer',
  );
  assert.equal(
    first.find(
      (e) => e.customData.modelId === 'user' && e.customData.role === 'box',
    )?.x,
    10,
  );
  assert.equal(
    second.find(
      (e) => e.customData.modelId === 'user' && e.customData.role === 'box',
    )?.x,
    450,
  );
  assert.notEqual(first[0].id, second[0].id);
});
void test('relationships only render when both endpoints are present, with correct UML direction', () => {
  const p = createProject(),
    d = p.diagrams[0];
  const scene = diagramSkeletons(p, d);
  const composition = scene.find(
    (e) => e.customData.relationshipId === 'contains',
  )!;
  assert.equal(composition.startArrowhead, 'diamond');
  assert.equal(composition.start?.id, 'uml-domain-order-box');
  assert.equal(composition.end?.id, 'uml-domain-item-box');
  d.classIds = d.classIds.filter((id) => id !== 'item');
  assert.ok(
    !diagramSkeletons(p, d).some(
      (e) => e.customData.relationshipId === 'contains',
    ),
  );
  assert.ok(p.relationships.some((r) => r.id === 'contains'));
});
