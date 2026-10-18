import assert from 'node:assert/strict';
import test from 'node:test';
import { dfdExample } from '../lib/course-dfd-examples.ts';
import { isNativeUmlMetadata } from '../lib/native-model-types.ts';
import type { NativeUmlMetadata } from '../lib/native-model-types.ts';
import type { PracticeSkeleton } from '../lib/practice.ts';

function metadata(element: PracticeSkeleton): NativeUmlMetadata | undefined {
  const data = element.customData;
  return typeof data === 'object' &&
    data !== null &&
    'uml' in data &&
    isNativeUmlMetadata(data.uml)
    ? data.uml
    : undefined;
}

const nodes = (elements: PracticeSkeleton[]) =>
  elements.filter((item) => metadata(item)?.role === 'node');
const flows = (elements: PracticeSkeleton[]) =>
  elements.filter((item) => metadata(item)?.kind === 'data-flow');

function boundary(
  elements: PracticeSkeleton[],
  inside: (item: PracticeSkeleton) => boolean,
): string[] {
  const byId = new Map(nodes(elements).map((item) => [item.id, item]));
  return flows(elements)
    .flatMap((item) => {
      const source = byId.get(item.start?.id ?? ''),
        target = byId.get(item.end?.id ?? '');
      assert.ok(
        source && target,
        'a boundary flow must have two existing endpoints',
      );
      if (inside(source) === inside(target)) return [];
      const other = inside(source) ? target : source;
      return [
        `${metadata(other)?.kind}|${metadata(other)?.name}|${inside(source) ? 'out' : 'in'}|${item.label?.text}`,
      ];
    })
    .sort();
}

for (const number of ['28', '29', '30']) {
  void test(`DFD lab ${number} has three editable, balanced levels and a balanced 1.0 expansion`, () => {
    const examples = dfdExample(number);
    assert.deepEqual(
      examples.map((item) => item.name),
      ['Level 0 (context)', 'Level 1', 'Level 2 (whole system; expands 1.0)'],
    );
    const [context, level1, level2] = examples;
    assert.ok(context && level1 && level2);
    const contextProcesses = nodes(context.elements).filter(
      (item) => metadata(item)?.kind === 'dfd-process',
    );
    assert.equal(contextProcesses.length, 1);
    assert.equal(
      nodes(context.elements).filter(
        (item) => metadata(item)?.kind === 'dfd-store',
      ).length,
      0,
    );
    const allProcesses = (item: PracticeSkeleton) =>
      metadata(item)?.kind === 'dfd-process';
    const systemBoundary = boundary(context.elements, allProcesses);
    const externalBoundary = (elements: PracticeSkeleton[]) =>
      boundary(elements, (item) => metadata(item)?.kind !== 'dfd-entity');
    assert.deepEqual(externalBoundary(level1.elements), systemBoundary);
    assert.deepEqual(externalBoundary(level2.elements), systemBoundary);
    assert.deepEqual(
      boundary(level2.elements, (item) =>
        /^1\.[1-9]\d*\b/.test(metadata(item)?.name ?? ''),
      ),
      boundary(level1.elements, (item) =>
        /^1\.0\b/.test(metadata(item)?.name ?? ''),
      ),
      'the refined process retains all parent flows, including flows to stores',
    );
    assert.deepEqual(
      nodes(level2.elements)
        .filter((item) => (metadata(item)?.name ?? '').startsWith('1.'))
        .map((item) => metadata(item)?.name?.match(/^1\.\d+/)?.[0])
        .sort((a, b) => (a ?? '').localeCompare(b ?? '')),
      ['1.1', '1.2', '1.3'],
    );
    for (const example of examples) {
      const boxes = nodes(example.elements);
      const byId = new Map(boxes.map((item) => [item.id, item]));
      const arrows = flows(example.elements);
      assert.equal(
        new Set(example.elements.map((item) => item.id)).size,
        example.elements.length,
      );
      for (const arrow of arrows) {
        assert.ok(arrow.label?.text.trim(), `${example.name}: unnamed flow`);
        assert.equal(arrow.type, 'arrow');
        assert.equal(arrow.startArrowhead, null);
        assert.equal(arrow.endArrowhead, 'arrow');
        const source = byId.get(arrow.start?.id ?? ''),
          target = byId.get(arrow.end?.id ?? '');
        assert.ok(source && target, `${example.name}: unbound flow`);
        assert.notEqual(source.id, target.id);
        assert.ok(
          metadata(source)?.kind === 'dfd-process' ||
            metadata(target)?.kind === 'dfd-process',
          `${example.name}: flow bypasses a process`,
        );
      }
      for (const box of boxes) {
        const input = arrows.filter((arrow) => arrow.end?.id === box.id);
        const output = arrows.filter((arrow) => arrow.start?.id === box.id);
        const data = metadata(box);
        assert.ok(
          input.length + output.length > 0,
          `${example.name}: disconnected ${data?.name}`,
        );
        if (data?.kind === 'dfd-process') {
          assert.ok(
            input.length > 0 && output.length > 0,
            `${example.name}: process needs input and output: ${data.name}`,
          );
          assert.match(data.name ?? '', /^\d+(?:\.\d+)?\n\S/);
          assert.ok(
            input.every((incoming) =>
              output.every(
                (outgoing) => incoming.label?.text !== outgoing.label?.text,
              ),
            ),
            `${example.name}: unchanged input/output name`,
          );
        }
        if (data?.kind === 'dfd-store')
          assert.match(data.name ?? '', /^D\d+\s+\S/);
      }
      for (let i = 0; i < boxes.length; i++) {
        const a = boxes[i];
        for (const b of boxes.slice(i + 1)) {
          const overlaps =
            a.x < b.x + (b.width ?? 0) &&
            a.x + (a.width ?? 0) > b.x &&
            a.y < b.y + (b.height ?? 0) &&
            a.y + (a.height ?? 0) > b.y;
          assert.equal(
            overlaps,
            false,
            `${example.name}: ${metadata(a)?.name} overlaps ${metadata(b)?.name}`,
          );
        }
      }
    }
  });
}

void test('DFD insertions get fresh element and semantic identities', () => {
  const first = dfdExample('28').flatMap((item) => item.elements);
  const firstIds = new Set(
    first.flatMap((item) => [item.id, metadata(item)?.id]),
  );
  for (const item of dfdExample('28').flatMap((example) => example.elements)) {
    assert.ok(!firstIds.has(item.id));
    assert.ok(!firstIds.has(metadata(item)?.id));
  }
});

void test('DFD examples reject an unknown lab instead of silently selecting another scenario', () => {
  assert.throws(() => dfdExample('27'), /Unknown DFD lab: 27/);
});
