import test from 'node:test';
import assert from 'node:assert/strict';
import { e, graph, n } from '../lib/course-builders.ts';
import type { PracticeSkeleton } from '../lib/practice.ts';
import { isNativeUmlMetadata } from '../lib/native-model-types.ts';

type Point = [number, number];
function route(arrow: PracticeSkeleton): Point[] {
  assert.ok(arrow.points);
  return arrow.points.map(([x, y]) => [arrow.x + x, arrow.y + y]);
}
function crossesBox(
  points: Point[],
  box: { x: number; y: number; width: number; height: number },
): boolean {
  return points.slice(1).some((point, index) => {
    const start = points[index];
    if (start[0] === point[0])
      return (
        start[0] > box.x &&
        start[0] < box.x + box.width &&
        Math.max(start[1], point[1]) > box.y &&
        Math.min(start[1], point[1]) < box.y + box.height
      );
    if (start[1] === point[1])
      return (
        start[1] > box.y &&
        start[1] < box.y + box.height &&
        Math.max(start[0], point[0]) > box.x &&
        Math.min(start[0], point[0]) < box.x + box.width
      );
    throw new Error('Expected orthogonal route in this fixture.');
  });
}
function overlappingSegment(a: Point[], b: Point[]): boolean {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) {
      const p = a[i - 1],
        q = a[i],
        r = b[j - 1],
        s = b[j];
      if (
        p[0] === q[0] &&
        r[0] === s[0] &&
        p[0] === r[0] &&
        Math.min(Math.max(p[1], q[1]), Math.max(r[1], s[1])) >
          Math.max(Math.min(p[1], q[1]), Math.min(r[1], s[1]))
      )
        return true;
      if (
        p[1] === q[1] &&
        r[1] === s[1] &&
        p[1] === r[1] &&
        Math.min(Math.max(p[0], q[0]), Math.max(r[0], s[0])) >
          Math.max(Math.min(p[0], q[0]), Math.min(r[0], s[0]))
      )
        return true;
    }
  return false;
}

void test('normal forward activity flow stays direct while a long return routes around the intervening action', () => {
  const scene = graph(
    [
      n('first', 'action', 'Insert card', 100, 0),
      n('middle', 'action', 'Enter PIN', 100, 200),
      n('last', 'action', 'Perform transaction', 100, 400),
    ],
    [
      e('first', 'middle', 'flow'),
      e('middle', 'last', 'flow'),
      e('last', 'first', 'flow', '[another transaction]'),
    ],
  );
  const arrows = scene.filter((element) => element.type === 'arrow');
  assert.equal(arrows[0].points?.length, 2);
  assert.equal(arrows[1].points?.length, 2);
  assert.ok((arrows[2].points?.length ?? 0) >= 4);
  assert.equal(
    crossesBox(route(arrows[2]), { x: 100, y: 200, width: 200, height: 70 }),
    false,
  );
  assert.equal(arrows[2].label?.text, '[another transaction]');
  assert.equal(
    arrows[2].start?.id,
    scene.find((element) => element.label?.text === 'Perform transaction')?.id,
  );
  assert.equal(
    arrows[2].end?.id,
    scene.find((element) => element.label?.text === 'Insert card')?.id,
  );
  const data = arrows[2].customData;
  assert.ok(
    data &&
      typeof data === 'object' &&
      'uml' in data &&
      isNativeUmlMetadata(data.uml) &&
      data.uml.kind === 'flow',
  );
  const absolute = route(arrows[2]);
  assert.equal(
    arrows[2].width,
    Math.max(...absolute.map(([x]) => x)) -
      Math.min(...absolute.map(([x]) => x)),
  );
  assert.equal(
    arrows[2].height,
    Math.max(...absolute.map(([, y]) => y)) -
      Math.min(...absolute.map(([, y]) => y)),
  );
});

void test('a direct segment blocked by a third node gains a shortest clear orthogonal lane', () => {
  const scene = graph(
    [
      n('a', 'action', 'Start', 0, 0),
      n('obstacle', 'action', 'Do not cross', 300, 0),
      n('b', 'action', 'Finish', 600, 0),
    ],
    [e('a', 'b', 'flow', 'continue')],
  );
  const arrow = scene.find((element) => element.type === 'arrow')!;
  assert.ok((arrow.points?.length ?? 0) >= 4);
  assert.equal(
    crossesBox(route(arrow), { x: 300, y: 0, width: 200, height: 70 }),
    false,
  );
  assert.ok((arrow.height ?? 0) > 0);
});

void test('reverse and parallel transitions use separate paths without sharing line segments', () => {
  for (const target of [
    [0, 250],
    [400, 250],
  ]) {
    const scene = graph(
      [
        n('a', 'state', 'Available', 0, 0),
        n('b', 'state', 'Loaned', target[0], target[1]),
      ],
      [
        e('a', 'b', 'transition', 'loan'),
        e('b', 'a', 'transition', 'return'),
        e('a', 'b', 'transition', 'reserve'),
      ],
    );
    const arrows = scene.filter((element) => element.type === 'arrow');
    for (let i = 0; i < arrows.length; i++)
      for (let j = i + 1; j < arrows.length; j++)
        assert.equal(
          overlappingSegment(route(arrows[i]), route(arrows[j])),
          false,
        );
    assert.deepEqual(
      arrows.map((arrow) => arrow.label?.text),
      ['loan', 'return', 'reserve'],
    );
  }
});

void test('self messages route outside their owning object and keep both bindings', () => {
  const scene = graph(
    [n('librarian', 'object', 'librarian : Librarian', 100, 100)],
    [e('librarian', 'librarian', 'numbered-message', '5: calculate fine')],
  );
  const node = scene[0],
    arrow = scene.find((element) => element.type === 'arrow')!;
  assert.equal(arrow.start?.id, node.id);
  assert.equal(arrow.end?.id, node.id);
  assert.equal(
    crossesBox(route(arrow), {
      x: node.x,
      y: node.y,
      width: node.width ?? 0,
      height: node.height ?? 0,
    }),
    false,
  );
  assert.ok((arrow.width ?? 0) > 0 && (arrow.height ?? 0) > 0);
});

void test('long reverse-transition labels receive different label regions instead of overlapping on parallel lines', () => {
  const scene = graph(
    [
      n('hot', 'state', 'Heating', 560, 70),
      n('idle', 'state', 'Idle', 560, 370),
    ],
    [
      e('hot', 'idle', 'transition', 'temperature [upper limit]'),
      e('idle', 'hot', 'transition', 'temperature [lower limit]'),
    ],
  );
  const centers = scene
    .filter((element) => element.type === 'arrow')
    .map((arrow): Point => {
      const points = route(arrow),
        middle = Math.floor(points.length / 2);
      return points.length % 2
        ? points[middle]
        : [
            (points[middle - 1][0] + points[middle][0]) / 2,
            (points[middle - 1][1] + points[middle][1]) / 2,
          ];
    });
  assert.ok(
    Math.abs(centers[0][0] - centers[1][0]) >= 180 ||
      Math.abs(centers[0][1] - centers[1][1]) >= 26,
  );
});
