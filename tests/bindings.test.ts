import test from 'node:test';
import assert from 'node:assert/strict';
import { repairSceneBindings } from '../lib/bindings.ts';
import type { SceneElement } from '../lib/model.ts';

function element(
  id: string,
  type: string,
  extra: Record<string, unknown> = {},
): SceneElement {
  return { id, type, x: 0, y: 0, width: 100, height: 50, ...extra };
}
void test('regenerated UML shapes retain native arrow bindings and generated text without stale label IDs', () => {
  const scene = [
    element('uml-box', 'rectangle', {
      boundElements: [{ id: 'old-label', type: 'text' }],
    }),
    element('label', 'text', { containerId: 'uml-box' }),
    element('native', 'arrow', {
      startBinding: { elementId: 'uml-box', gap: 8, focus: 0.4 },
      endBinding: null,
    }),
  ];
  const snapshot = structuredClone(scene);
  const result = repairSceneBindings(scene);
  assert.deepEqual(result[0].boundElements, [
    { id: 'label', type: 'text' },
    { id: 'native', type: 'arrow' },
  ]);
  assert.deepEqual(result[2].startBinding, {
    elementId: 'uml-box',
    gap: 8,
    focus: 0.4,
  });
  assert.deepEqual(scene, snapshot);
});
void test('self-connected arrows have exactly one reciprocal entry and repairs are idempotent', () => {
  const scene = [
    element('box', 'rectangle'),
    element('arrow', 'arrow', {
      startBinding: { elementId: 'box' },
      endBinding: { elementId: 'box' },
    }),
  ];
  const result = repairSceneBindings(scene);
  assert.deepEqual(result[0].boundElements, [{ id: 'arrow', type: 'arrow' }]);
  assert.deepEqual(repairSceneBindings(result), result);
});
void test('removing a UML shape clears dangling arrow and text bindings without moving native content', () => {
  const scene = [
    element('live', 'rectangle'),
    element('deleted', 'rectangle', { isDeleted: true }),
    element('arrow', 'arrow', {
      x: 240,
      points: [
        [0, 0],
        [100, 50],
      ],
      startBinding: { elementId: 'missing' },
      endBinding: { elementId: 'live', focus: 0.3 },
    }),
    element('text', 'text', { containerId: 'deleted', text: 'keep me' }),
  ];
  const result = repairSceneBindings(scene);
  assert.equal(result[2].startBinding, null);
  assert.deepEqual(result[2].endBinding, { elementId: 'live', focus: 0.3 });
  assert.equal(result[2].x, 240);
  assert.deepEqual(result[2].points, [
    [0, 0],
    [100, 50],
  ]);
  assert.equal(result[3].containerId, null);
  assert.equal(result[3].text, 'keep me');
  assert.deepEqual(result[0].boundElements, [{ id: 'arrow', type: 'arrow' }]);
});
void test('deleted arrows and stale native reciprocal references are removed', () => {
  const scene = [
    element('box', 'rectangle', {
      boundElements: [
        { id: 'arrow', type: 'arrow' },
        { id: 'gone', type: 'text' },
      ],
    }),
    element('arrow', 'arrow', {
      isDeleted: true,
      startBinding: { elementId: 'box' },
    }),
  ];
  const result = repairSceneBindings(scene);
  assert.equal(result[0].boundElements, null);
  assert.equal(result[1].startBinding, null);
});
