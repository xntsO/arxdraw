import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diagramKinds,
  practiceTools,
  symbolSkeletons,
  exampleSkeletons,
  exampleTitle,
  connectorSkeleton,
  isPracticeConnector,
} from '../lib/practice.ts';

void test('every practice kind has a complete editable palette and an example with valid bindings', () => {
  assert.equal(diagramKinds.length, 9);
  for (const { id } of diagramKinds) {
    assert.ok(exampleTitle(id));
    const symbols = practiceTools(id).flatMap((tool) =>
      symbolSkeletons(tool.id, 10, 20),
    );
    const scene = exampleSkeletons(id);
    assert.ok(symbols.length > 0);
    assert.ok(scene.length > 4, id);
    for (const elements of [symbols, scene]) {
      const ids = new Set(elements.map((element) => element.id));
      assert.equal(ids.size, elements.length, `${id}: duplicate element IDs`);
      for (const element of elements) {
        assert.ok(Number.isFinite(element.x) && Number.isFinite(element.y));
        const linear = element.type === 'line' || element.type === 'arrow';
        if (element.width !== undefined)
          assert.ok(
            Number.isFinite(element.width) &&
              (linear ? element.width >= 0 : element.width > 0),
          );
        if (element.height !== undefined)
          assert.ok(
            Number.isFinite(element.height) &&
              (linear ? element.height >= 0 : element.height > 0),
          );
        assert.equal(
          element.customData,
          undefined,
          'native symbols must survive shared-model rerender',
        );
        if (element.start)
          assert.ok(ids.has(element.start.id), `${id}: dangling source`);
        if (element.end)
          assert.ok(ids.has(element.end.id), `${id}: dangling target`);
        if (element.type === 'arrow' || element.type === 'line') {
          assert.ok(element.points && element.points.length >= 2);
          assert.ok(
            element.points.every(
              (point) => point.length === 2 && point.every(Number.isFinite),
            ),
          );
          assert.ok(element.points.some(([x, y]) => x !== 0 || y !== 0));
        }
      }
    }
  }
});
void test('repeated insertions never reuse element IDs or composite group IDs', () => {
  const first = exampleSkeletons('use-case'),
    second = exampleSkeletons('use-case');
  const firstIds = new Set(
    first.flatMap((element) => [element.id, ...(element.groupIds ?? [])]),
  );
  for (const element of second) {
    assert.ok(!firstIds.has(element.id));
    for (const group of element.groupIds ?? []) assert.ok(!firstIds.has(group));
  }
  const actor = symbolSkeletons('actor', 0, 0);
  assert.ok(actor.length > 3);
  assert.equal(new Set(actor.flatMap((element) => element.groupIds)).size, 1);
});
void test('use-case include points from base to included case and extend from optional to base', () => {
  const elements = exampleSkeletons('use-case');
  const checkout = elements.find(
    (element) => element.label?.text === 'Checkout',
  )!;
  const payment = elements.find(
    (element) => element.label?.text === 'Pay order',
  )!;
  const coupon = elements.find(
    (element) => element.label?.text === 'Apply coupon',
  )!;
  const include = elements.find(
    (element) => element.label?.text === '«include»',
  )!;
  const extend = elements.find((element) =>
    element.label?.text.startsWith('«extend»'),
  )!;
  assert.equal(include.start?.id, checkout.id);
  assert.equal(include.end?.id, payment.id);
  assert.equal(extend.start?.id, coupon.id);
  assert.equal(extend.end?.id, checkout.id);
  assert.equal(include.strokeStyle, 'dashed');
  assert.equal(extend.endArrowhead, 'arrow');
});
void test('activity example includes conditional branches and joined parallel actions', () => {
  const elements = exampleSkeletons('activity');
  const decision = elements.find((element) => element.type === 'diamond')!;
  const outgoing = elements.filter(
    (element) => element.start?.id === decision.id,
  );
  assert.deepEqual(
    outgoing
      .map((element) => element.label?.text)
      .sort((a, b) => (a ?? '').localeCompare(b ?? '')),
    ['[no]', '[yes]'],
  );
  const bars = elements.filter(
    (element) => element.type === 'rectangle' && element.height === 10,
  );
  assert.equal(bars.length, 2);
  assert.equal(
    elements.filter((element) => element.start?.id === bars[0].id).length,
    2,
  );
  assert.equal(
    elements.filter((element) => element.end?.id === bars[1].id).length,
    2,
  );
});
void test('sequence calls are ordered, returns dashed, and all messages bind to activations', () => {
  const elements = exampleSkeletons('sequence');
  const activations = new Set(
    elements
      .filter((element) => element.width === 18)
      .map((element) => element.id),
  );
  const messages = elements.filter((element) => element.type === 'arrow');
  assert.equal(messages.length, 4);
  assert.deepEqual(
    messages.map((element) => element.y),
    messages.map((element) => element.y).sort((a, b) => a - b),
  );
  assert.deepEqual(
    messages.map((element) => element.strokeStyle),
    ['solid', 'solid', 'dashed', 'dashed'],
  );
  for (const message of messages) {
    assert.ok(activations.has(message.start!.id));
    assert.ok(activations.has(message.end!.id));
  }
});
void test('practice connectors retain requested endpoints, labels, and UML arrowheads', () => {
  const generalization = connectorSkeleton(
    'generalization',
    40,
    50,
    -10,
    100,
    undefined,
    'child',
    'parent',
  );
  assert.deepEqual(generalization.points, [
    [0, 0],
    [-50, 50],
  ]);
  assert.deepEqual(generalization.start, { id: 'child' });
  assert.deepEqual(generalization.end, { id: 'parent' });
  assert.equal(generalization.endArrowhead, 'triangle_outline');
  assert.equal(connectorSkeleton('association', 0, 0, 1, 1).endArrowhead, null);
  assert.equal(
    connectorSkeleton('message', 0, 0, 1, 1).endArrowhead,
    'triangle',
  );
  assert.equal(connectorSkeleton('return', 0, 0, 1, 1).strokeStyle, 'dashed');
  assert.equal(
    connectorSkeleton('flow', 0, 0, 1, 1, '[yes]').label?.text,
    '[yes]',
  );
  assert.ok(isPracticeConnector('include'));
  assert.ok(!isPracticeConnector('actor'));
});
void test('template coordinates translate consistently without altering contents', () => {
  const first = exampleSkeletons('deployment', 0, 0);
  const moved = exampleSkeletons('deployment', -200, 500);
  assert.equal(first.length, moved.length);
  first.forEach((element, index) => {
    assert.equal(moved[index].x, element.x - 200);
    assert.equal(moved[index].y, element.y + 500);
    assert.deepEqual(moved[index].label, element.label);
  });
});

void test('native line bounds match their points for selection and resizing', () => {
  const lifeline = symbolSkeletons('participant', 0, 0).find(
    (element) => element.type === 'line',
  )!;
  assert.equal(lifeline.width, 0);
  assert.equal(lifeline.height, 400);
  const underline = symbolSkeletons('object', 0, 0).find(
    (element) => element.type === 'line',
  )!;
  assert.equal(underline.width, 190);
  assert.equal(underline.height, 0);
});
