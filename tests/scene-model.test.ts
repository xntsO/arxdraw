import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, parseProject } from '../lib/model.ts';
import type { SceneElement } from '../lib/model.ts';
import { reconcileDuplicatedClasses } from '../lib/scene-model.ts';
import { diagramSkeletons } from '../lib/diagram.ts';

const part = (
  id: string,
  group: string,
  role: string,
  x = 20,
  modelId = 'user',
): SceneElement => ({
  id,
  type: role === 'box' ? 'rectangle' : 'text',
  x,
  y: 30,
  width: 280,
  height: role === 'box' ? 200 : 24,
  groupIds: [group, 'outer'],
  customData: { modelId, role, arxdraw: true },
});
void test('a native duplicate becomes an independent classifier while retaining its position and members', () => {
  const before = createProject(),
    d = before.diagrams[0];
  d.elements = [
    part('uml-domain-user-box', 'original', 'box'),
    part('original-name', 'original', 'name'),
    part('copied-box', 'copy', 'box', 450),
    part('copied-name', 'copy', 'name', 460),
    part('copied-attributes', 'copy', 'attributes', 460),
  ];
  const snapshot = structuredClone(before);
  const after = reconcileDuplicatedClasses(before, d.id);
  assert.notEqual(after, before);
  assert.deepEqual(before, snapshot);
  const copy = after.classes.find((c) => c.name === 'User2')!;
  assert.ok(copy);
  assert.equal(copy.attributes, before.classes[0].attributes);
  assert.equal(copy.operations, before.classes[0].operations);
  assert.deepEqual(after.diagrams[0].classIds, [...d.classIds, copy.id]);
  assert.equal(after.diagrams[0].elements[0], d.elements[0]);
  assert.equal(after.diagrams[0].elements[1], d.elements[1]);
  for (const element of after.diagrams[0].elements.slice(2))
    assert.equal(element.customData?.modelId, copy.id);
  assert.equal(after.diagrams[0].elements[2].x, 450);
  assert.equal(after.diagrams[1], before.diagrams[1]);
  assert.equal(after.relationships, before.relationships);
  assert.deepEqual(parseProject(JSON.stringify(after)), after);
  const rendered = diagramSkeletons(after, after.diagrams[0]);
  assert.equal(
    rendered.find(
      (e) => e.customData.modelId === copy.id && e.customData.role === 'box',
    )?.x,
    450,
  );
  assert.equal(reconcileDuplicatedClasses(after, d.id), after);
});
void test('canonical original wins even if copied elements occur first, with unique copy names', () => {
  const before = createProject(),
    d = before.diagrams[0];
  before.classes.push({ ...before.classes[0], id: 'existing', name: 'User2' });
  d.elements = [
    part('copy1', 'g1', 'box', 300),
    part('copy2', 'g2', 'box', 600),
    part('uml-domain-user-box', 'original', 'box'),
  ];
  const after = reconcileDuplicatedClasses(before, d.id);
  assert.deepEqual(
    after.classes.slice(-2).map((c) => c.name),
    ['User3', 'User4'],
  );
  assert.equal(after.diagrams[0].elements[2].customData?.modelId, 'user');
});
void test('fallback original and ungrouped duplicates only remap their own box', () => {
  const before = createProject(),
    d = before.diagrams[0];
  const first = part('first', 'same-group', 'box');
  const second = part('second', 'same-group', 'box', 200);
  d.elements = [first, second, part('ambiguous-label', 'same-group', 'name')];
  const after = reconcileDuplicatedClasses(before, d.id);
  assert.equal(after.diagrams[0].elements[0], first);
  assert.notEqual(after.diagrams[0].elements[1].customData?.modelId, 'user');
  assert.equal(after.diagrams[0].elements[2], d.elements[2]);
});
void test('deleted boxes, freehand, relationships and other classifiers are untouched', () => {
  const before = createProject(),
    d = before.diagrams[0];
  const deleted = { ...part('deleted', 'copy', 'box'), isDeleted: true };
  const freehand = {
    id: 'freehand',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    groupIds: ['copy'],
  };
  const relationship = {
    ...part('relationship', 'copy', 'label'),
    customData: {
      modelId: 'user',
      relationshipId: 'places',
      role: 'label',
      arxdraw: true,
    },
  };
  const order = part('order-label', 'copy', 'name', 700, 'order');
  d.elements = [
    part('uml-domain-user-box', 'original', 'box'),
    part('copied', 'copy', 'box'),
    deleted,
    freehand,
    relationship,
    order,
  ];
  const after = reconcileDuplicatedClasses(before, d.id);
  for (let i = 2; i < d.elements.length; i++)
    assert.equal(after.diagrams[0].elements[i], d.elements[i]);
  const justDeleted = {
    ...before,
    diagrams: [
      { ...d, elements: [d.elements[0], deleted] },
      before.diagrams[1],
    ],
  };
  assert.equal(reconcileDuplicatedClasses(justDeleted, d.id), justDeleted);
  assert.equal(reconcileDuplicatedClasses(before, 'missing'), before);
});

void test('large numeric suffixes cannot stall duplicate naming', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  project.classes[0].name = 'User9007199254740990';
  project.classes.push({
    ...project.classes[0],
    id: 'large1',
    name: 'User9007199254740991',
  });
  project.classes.push({
    ...project.classes[0],
    id: 'large2',
    name: 'User9007199254740992',
  });
  diagram.elements = [
    part('uml-domain-user-box', 'original', 'box'),
    part('copied', 'copy', 'box'),
  ];
  const result = reconcileDuplicatedClasses(project, diagram.id);
  assert.equal(result.classes.at(-1)?.name, 'User2');
});
