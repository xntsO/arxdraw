import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramSkeletons, type UmlSkeleton } from '../lib/diagram.ts';
import {
  createBlankProject,
  type Relationship,
  type SceneElement,
} from '../lib/model.ts';

function fixture() {
  const p = createBlankProject();
  p.classes = ['a', 'b'].map((id) => ({
    id,
    name: id.toUpperCase(),
    kind: 'class' as const,
    attributes: '- id: String',
    operations: '+ run(): void',
    description: '',
  }));
  const d = p.diagrams[0];
  d.classIds = ['a', 'b'];
  const relation: Relationship = {
    id: 'ab',
    from: 'a',
    to: 'b',
    kind: 'association',
    label: 'owns',
    sourceMultiplicity: '1',
    targetMultiplicity: '0..*',
  };
  p.relationships = [relation];
  d.relationshipIds = ['ab'];
  return { p, d, relation };
}
function arrow(scene: UmlSkeleton[], id = 'ab') {
  return scene.find(
    (e) => e.type === 'arrow' && e.customData.relationshipId === id,
  )!;
}
function absolutePoints(element: UmlSkeleton) {
  return (element.points as number[][]).map(([x, y]) => [
    element.x + x,
    element.y + y,
  ]);
}
function sceneElement(element: UmlSkeleton): SceneElement {
  return { width: 0, height: 0, ...element } as SceneElement;
}

void test('multiplicities have independent endpoint positions and do not pollute the relation name', () => {
  const { p, d } = fixture();
  const scene = diagramSkeletons(p, d),
    a = arrow(scene);
  const source = scene.find((e) => e.customData.role === 'sourceMultiplicity')!;
  const target = scene.find((e) => e.customData.role === 'targetMultiplicity')!;
  const path = absolutePoints(a);
  assert.equal(source.text, '1');
  assert.equal(target.text, '0..*');
  assert.deepEqual(a.label, { text: 'owns', fontSize: 14, fontFamily: 2 });
  assert.ok(Math.hypot(source.x - path[0][0], source.y - path[0][1]) < 60);
  assert.ok(
    Math.hypot(target.x - path.at(-1)![0], target.y - path.at(-1)![1]) < 60,
  );
  assert.notEqual(source.id, target.id);
});

void test('parallel and reverse relationships use different paths', () => {
  const { p, d, relation } = fixture();
  p.relationships.push({ ...relation, id: 'ba', from: 'b', to: 'a' });
  d.relationshipIds.push('ba');
  const scene = diagramSkeletons(p, d);
  assert.notDeepEqual(
    absolutePoints(arrow(scene)),
    absolutePoints(arrow(scene, 'ba')).reverse(),
  );
  assert.equal((arrow(scene).points as number[][]).length, 3);
});

void test('self associations form a visible loop outside the classifier', () => {
  const { p, d, relation } = fixture();
  relation.to = 'a';
  const scene = diagramSkeletons(p, d),
    a = arrow(scene);
  const box = scene.find(
    (e) => e.customData.modelId === 'a' && e.customData.role === 'box',
  )!;
  const path = absolutePoints(a);
  assert.equal(path.length, 5);
  assert.ok(path[1][0] > box.x + (box.width as number));
  assert.ok(path[2][1] < box.y);
  assert.notDeepEqual(path[0], path.at(-1));
  assert.equal(a.start?.id, a.end?.id);
});

void test('vertically stacked classifiers bind at top and bottom rather than crossing the boxes', () => {
  const { p, d } = fixture();
  d.elements = ['a', 'b'].map((id, i) => ({
    id,
    type: 'rectangle',
    x: 100,
    y: i * 400,
    width: 260,
    height: 180,
    customData: { modelId: id, role: 'box' },
  }));
  const path = absolutePoints(arrow(diagramSkeletons(p, d)));
  assert.equal(path[0][0], path[1][0]);
  assert.ok(path[0][1] > 180 && path[1][1] < 400);
});

void test('UML arrowheads preserve source ownership and target inheritance directions', () => {
  const { p, d, relation } = fixture();
  for (const [kind, start, end, dashed] of [
    ['composition', 'diamond', null, false],
    ['aggregation', 'diamond_outline', null, false],
    ['inheritance', null, 'triangle_outline', false],
    ['realization', null, 'triangle_outline', true],
    ['dependency', null, 'arrow', true],
  ] as const) {
    relation.kind = kind;
    const a = arrow(diagramSkeletons(p, d));
    assert.equal(a.startArrowhead, start);
    assert.equal(a.endArrowhead, end);
    assert.equal(a.strokeStyle, dashed ? 'dashed' : 'solid');
    assert.ok(a.start?.id.endsWith('-a-box'));
    assert.ok(a.end?.id.endsWith('-b-box'));
  }
});

void test('editing a class retains its visual styling and a manually routed relation', () => {
  const { p, d } = fixture();
  const scene = diagramSkeletons(p, d);
  d.elements = scene.map(sceneElement);
  const box = d.elements.find(
    (e) => e.customData?.modelId === 'a' && e.customData?.role === 'box',
  )!;
  Object.assign(box, {
    strokeColor: '#e03131',
    backgroundColor: '#fff3bf',
    strokeWidth: 4,
    roughness: 2,
    opacity: 60,
  });
  const old = d.elements.find((e) => e.type === 'arrow')!;
  const end = (old.points as number[][]).at(-1)!;
  Object.assign(old, {
    points: [[0, 0], [40, -80], [end[0] - 40, -80], end],
    strokeColor: '#1971c2',
    strokeWidth: 3,
  });
  p.classes[0].name = 'Customer';
  const updated = diagramSkeletons(p, d);
  const updatedBox = updated.find(
    (e) => e.customData.modelId === 'a' && e.customData.role === 'box',
  )!;
  assert.equal(updatedBox.strokeColor, '#e03131');
  assert.equal(updatedBox.backgroundColor, '#fff3bf');
  assert.equal(updatedBox.strokeWidth, 4);
  assert.equal(updatedBox.roughness, 2);
  assert.equal(updatedBox.opacity, 60);
  assert.deepEqual(arrow(updated).points, old.points);
  assert.equal(arrow(updated).strokeColor, '#1971c2');
  assert.equal(arrow(updated).strokeWidth, 3);
});

void test('changing relationship kind resets dashed notation while keeping user color', () => {
  const { p, d, relation } = fixture();
  d.elements = diagramSkeletons(p, d).map(sceneElement);
  const old = d.elements.find((e) => e.type === 'arrow')!;
  old.strokeColor = '#1971c2';
  relation.kind = 'realization';
  const updated = arrow(diagramSkeletons(p, d));
  assert.equal(updated.strokeStyle, 'dashed');
  assert.equal(updated.endArrowhead, 'triangle_outline');
  assert.equal(updated.strokeColor, '#1971c2');
});
