import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, parseProject } from '../lib/model.ts';
import type { SceneElement } from '../lib/model.ts';
import {
  reconcileDuplicatedClasses,
  reconcileClassRelationships,
} from '../lib/scene-model.ts';
import { diagramSkeletons } from '../lib/diagram.ts';

void test('foreign class pastes and copied arrows with unresolved ends survive as editable drawings', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  diagram.elements = [
    {
      id: 'foreign-box',
      type: 'rectangle',
      x: 20,
      y: 30,
      width: 250,
      height: 200,
      customData: { arxdraw: true, modelId: 'foreign', role: 'box' },
    },
    {
      id: 'foreign-name',
      type: 'text',
      text: 'Foreign',
      x: 30,
      y: 40,
      width: 100,
      height: 20,
      customData: { arxdraw: true, modelId: 'foreign', role: 'name' },
    },
    {
      id: 'copied-arrow',
      type: 'arrow',
      x: 250,
      y: 100,
      width: 200,
      height: 0,
      customData: { arxdraw: true, relationshipId: 'places' },
      startBinding: { elementId: 'missing' },
      endBinding: { elementId: 'also-missing' },
    },
  ];
  const preserved = reconcileClassRelationships(
    reconcileDuplicatedClasses(project, diagram.id),
    diagram.id,
  );
  assert.equal(preserved.classes.length, project.classes.length);
  assert.equal(preserved.diagrams[0].elements.length, 3);
  assert.ok(
    preserved.diagrams[0].elements.every(
      (element) => !element.customData?.arxdraw,
    ),
  );
  assert.equal(preserved.diagrams[0].elements[1].text, 'Foreign');
  assert.equal(reconcileDuplicatedClasses(preserved, diagram.id), preserved);
  assert.equal(reconcileClassRelationships(preserved, diagram.id), preserved);
});

void test('demoting an unresolved class arrow preserves its bound label and multiplicities without stale UML route data', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  const base = { x: 10, y: 20, width: 200, height: 20 };
  diagram.elements = [
    {
      ...base,
      id: 'rel-domain-places',
      type: 'arrow',
      customData: { arxdraw: true, relationshipId: 'places' },
    },
    {
      ...base,
      id: 'original-label',
      type: 'text',
      text: 'original',
      containerId: 'rel-domain-places',
      customData: { arxdraw: true },
    },
    {
      ...base,
      id: 'rel-domain-places-sourceMultiplicity',
      type: 'text',
      text: '1',
      customData: {
        arxdraw: true,
        relationshipId: 'places',
        role: 'sourceMultiplicity',
      },
    },
    {
      ...base,
      id: 'copy',
      type: 'arrow',
      customData: {
        arxdraw: true,
        relationshipId: 'places',
        from: 'user',
        to: 'order',
        kind: 'association',
        manualRoute: true,
        routePoints: [
          [0, 0],
          [200, 0],
        ],
      },
    },
    {
      ...base,
      id: 'copy-label',
      type: 'text',
      text: 'keep copied words',
      containerId: 'copy',
      customData: { arxdraw: true },
    },
    {
      ...base,
      id: 'copy-multiplicity',
      type: 'text',
      text: '0..*',
      customData: {
        arxdraw: true,
        relationshipId: 'places',
        role: 'targetMultiplicity',
      },
    },
  ];
  const reconciled = reconcileClassRelationships(project, diagram.id);
  assert.equal(reconciled.diagrams[0].elements[1], diagram.elements[1]);
  assert.equal(reconciled.diagrams[0].elements[2], diagram.elements[2]);
  for (const element of reconciled.diagrams[0].elements.slice(3)) {
    assert.ok(!element.customData?.arxdraw);
    assert.equal(element.customData?.relationshipId, undefined);
    assert.equal(element.customData?.from, undefined);
    assert.equal(element.customData?.routePoints, undefined);
  }
  assert.equal(reconciled.diagrams[0].elements[4].text, 'keep copied words');
});

void test('a native class connector can bind to name or compartment text', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  diagram.elements = [
    {
      id: 'name',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      text: 'User',
      customData: { arxdraw: true, modelId: 'user', role: 'name' },
    },
    {
      id: 'operations',
      type: 'text',
      x: 400,
      y: 0,
      width: 100,
      height: 60,
      text: '+ calculateTotal()',
      customData: { arxdraw: true, modelId: 'order', role: 'operations' },
    },
    {
      id: 'native',
      type: 'arrow',
      x: 100,
      y: 10,
      width: 300,
      height: 0,
      startBinding: { elementId: 'name' },
      endBinding: { elementId: 'operations' },
    },
  ];
  const linked = reconcileClassRelationships(project, diagram.id, {
    defaultKind: 'dependency',
  });
  assert.equal(linked.relationships.at(-1)?.from, 'user');
  assert.equal(linked.relationships.at(-1)?.to, 'order');
  assert.equal(linked.relationships.at(-1)?.kind, 'dependency');
});

void test('foreign class and relationship pastes retain all their label text as drawings', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  const base = { x: 0, y: 0, width: 200, height: 30 };
  diagram.elements = [
    {
      ...base,
      id: 'foreign-class',
      type: 'rectangle',
      customData: { arxdraw: true, modelId: 'foreign', role: 'box' },
    },
    {
      ...base,
      id: 'foreign-arrow',
      type: 'arrow',
      customData: {
        arxdraw: true,
        relationshipId: 'foreign-link',
        from: 'foreign',
        kind: 'dependency',
      },
    },
    {
      ...base,
      id: 'foreign-label',
      type: 'text',
      text: 'Foreign link',
      containerId: 'foreign-arrow',
      customData: { arxdraw: true },
    },
    {
      ...base,
      id: 'foreign-multiplicity',
      type: 'text',
      text: '*',
      customData: {
        arxdraw: true,
        relationshipId: 'foreign-link',
        role: 'targetMultiplicity',
      },
    },
  ];
  const preserved = reconcileDuplicatedClasses(project, diagram.id);
  assert.ok(
    preserved.diagrams[0].elements.every(
      (element) => !element.customData?.arxdraw,
    ),
  );
  assert.equal(preserved.diagrams[0].elements[2].text, 'Foreign link');
  assert.equal(preserved.diagrams[0].elements[3].text, '*');
});

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
void test('pasting a shared classifier into another diagram keeps its identity and position on redraw', () => {
  const before = createProject();
  const target = before.diagrams[1];
  assert.ok(!target.classIds.includes('item'));
  target.elements = [
    part('pasted-box', 'pasted', 'box', 750, 'item'),
    part('pasted-name', 'pasted', 'name', 760, 'item'),
  ];
  const after = reconcileDuplicatedClasses(before, target.id);
  assert.equal(after.classes.length, before.classes.length);
  assert.ok(after.diagrams[1].classIds.includes('item'));
  assert.equal(after.diagrams[1].elements[0].customData?.modelId, 'item');
  const rendered = diagramSkeletons(after, after.diagrams[1]);
  assert.equal(
    rendered.find(
      (element) =>
        element.customData.modelId === 'item' &&
        element.customData.role === 'box',
    )?.x,
    750,
  );
  assert.equal(reconcileDuplicatedClasses(after, target.id), after);
});

const nativeArrow = (id: string, start: string, end: string): SceneElement => ({
  id,
  type: 'arrow',
  x: 300,
  y: 100,
  width: 200,
  height: 0,
  points: [
    [0, 0],
    [100, 50],
    [200, 0],
  ],
  startBinding: { elementId: start, focus: 0, gap: 2 },
  endBinding: { elementId: end, focus: 0, gap: 2 },
  endArrowhead: 'triangle_outline',
  strokeStyle: 'solid',
});
void test('a bound native arrow becomes an inheritance link with label, manual route and idempotent sync', () => {
  const before = createProject(),
    diagram = before.diagrams[0];
  diagram.elements = [
    part('user-box', 'u', 'box'),
    part('order-box', 'o', 'box', 600, 'order'),
    nativeArrow('native', 'user-box', 'order-box'),
    {
      id: 'edge-label',
      type: 'text',
      x: 350,
      y: 100,
      width: 50,
      height: 20,
      text: 'extends',
      containerId: 'native',
    },
  ];
  const after = reconcileClassRelationships(before, diagram.id);
  assert.equal(before.relationships.length, 3);
  const relationship = after.relationships[3];
  assert.equal(relationship.kind, 'inheritance');
  assert.equal(relationship.from, 'user');
  assert.equal(relationship.to, 'order');
  assert.equal(relationship.label, 'extends');
  assert.ok(after.diagrams[0].relationshipIds.includes(relationship.id));
  assert.equal(
    after.diagrams[0].elements[3].customData?.relationshipId,
    relationship.id,
  );
  const regenerated = diagramSkeletons(after, after.diagrams[0]).find(
    (element) => element.customData.relationshipId === relationship.id,
  )!;
  assert.equal(regenerated.endArrowhead, 'triangle_outline');
  assert.equal(regenerated.customData.manualRoute, true);
  assert.equal(reconcileClassRelationships(after, diagram.id), after);
});

void test('freehand arrows, unbound endpoints and non-class diagrams keep their drawing behavior', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  diagram.elements = [
    part('user-box', 'u', 'box'),
    nativeArrow('native', 'user-box', 'freehand'),
  ];
  assert.equal(reconcileClassRelationships(project, diagram.id), project);
  diagram.elements.push(part('order-box', 'o', 'box', 600, 'order'));
  diagram.elements[1] = nativeArrow('native', 'user-box', 'order-box');
  diagram.kind = 'sequence';
  assert.equal(reconcileClassRelationships(project, diagram.id), project);
});

void test('duplicating classes and their relationship creates a distinct linked model and preserves originals', () => {
  const before = createProject(),
    diagram = before.diagrams[0];
  diagram.elements = [
    part('uml-domain-user-box', 'u', 'box'),
    part('uml-domain-order-box', 'o', 'box', 500, 'order'),
    {
      ...nativeArrow(
        'rel-domain-places',
        'uml-domain-user-box',
        'uml-domain-order-box',
      ),
      customData: { relationshipId: 'places', arxdraw: true },
    },
    part('copy-user', 'cu', 'box', 800),
    part('copy-order', 'co', 'box', 1200, 'order'),
    {
      ...nativeArrow('copy-edge', 'copy-user', 'copy-order'),
      customData: { relationshipId: 'places', arxdraw: true },
    },
  ];
  const duplicated = reconcileDuplicatedClasses(before, diagram.id);
  const after = reconcileClassRelationships(duplicated, diagram.id);
  const copy = after.relationships[3];
  assert.equal(copy.from, after.classes[4].id);
  assert.equal(copy.to, after.classes[5].id);
  assert.equal(copy.kind, 'association');
  assert.equal(after.relationships[0], before.relationships[0]);
  assert.equal(
    after.diagrams[0].elements[5].customData?.relationshipId,
    copy.id,
  );
  assert.equal(reconcileClassRelationships(after, diagram.id), after);
});

void test('rebinding a semantic arrow changes its shared endpoints; pasting a relation into another diagram adds its view', () => {
  const before = createProject(),
    diagram = before.diagrams[0];
  diagram.elements = [
    part('u', 'u', 'box'),
    part('i', 'i', 'box', 700, 'item'),
    {
      ...nativeArrow('rel-domain-places', 'u', 'i'),
      customData: { relationshipId: 'places', arxdraw: true },
    },
  ];
  const rebound = reconcileClassRelationships(before, diagram.id);
  assert.equal(rebound.relationships[0].to, 'item');
  assert.equal(before.relationships[0].to, 'order');
  const target = before.diagrams[1];
  target.elements = [
    part('u', 'u', 'box'),
    part('o', 'o', 'box', 500, 'order'),
    {
      ...nativeArrow('pasted-edge', 'u', 'o'),
      customData: { relationshipId: 'contains', arxdraw: true },
    },
  ];
  // This pasted relationship's endpoints differ from the shared source link;
  // it must get its own identity rather than rewiring the source diagram.
  const pasted = reconcileClassRelationships(before, target.id);
  assert.equal(pasted.relationships[1].from, 'order');
  assert.equal(pasted.relationships[1].to, 'item');
  assert.equal(pasted.relationships[3].from, 'user');
  assert.equal(pasted.relationships[3].to, 'order');
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
