import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  duplicateDiagram,
  mergeProjects,
  parseProject,
  projectDiagnostics,
} from '../lib/model.ts';
import type { Project, SceneElement } from '../lib/model.ts';
import {
  connectorSkeleton,
  exampleSkeletons,
  practiceTools,
  symbolSkeletons,
} from '../lib/practice.ts';
import type { PracticeSkeleton } from '../lib/practice.ts';
import {
  nativeUmlMetadata,
  reconcileNativeUmlScene,
  updateNativeUmlElement,
} from '../lib/native-model.ts';

function converted(skeletons: PracticeSkeleton[]): SceneElement[] {
  return skeletons.flatMap((skeleton): SceneElement[] => [
    {
      ...skeleton,
      width: skeleton.width ?? 160,
      height: skeleton.height ?? 24,
      ...(skeleton.text !== undefined ? { originalText: skeleton.text } : {}),
      ...(skeleton.start
        ? { startBinding: { elementId: skeleton.start.id } }
        : {}),
      ...(skeleton.end ? { endBinding: { elementId: skeleton.end.id } } : {}),
    },
    ...(skeleton.label
      ? [
          {
            id: `label-${skeleton.id}`,
            type: 'text',
            x: skeleton.x + 10,
            y: skeleton.y + 10,
            width: 160,
            height: 24,
            text: skeleton.label.text,
            originalText: skeleton.label.text,
            containerId: skeleton.id,
          },
        ]
      : []),
  ]);
}
function dfdProject(): Project {
  const project = createBlankProject();
  project.diagrams[0].kind = 'data-flow';
  project.diagrams[0].elements = converted(exampleSkeletons('data-flow'));
  return reconcileNativeUmlScene(project, project.activeDiagramId);
}

void test('DFD palette and symbols use process ellipses, entity rectangles and open parallel stores', () => {
  assert.deepEqual(
    practiceTools('data-flow')
      .map((tool) => tool.id)
      .slice(0, 4),
    ['dfd-process', 'dfd-entity', 'dfd-store', 'data-flow'],
  );
  const process = symbolSkeletons('dfd-process', 10, 20, 'Reserve ticket', {
    processNumber: '1.0',
  });
  assert.equal(process[0].type, 'ellipse');
  assert.equal(process[0].label?.text, '1.0\nReserve ticket');
  assert.equal(
    symbolSkeletons('dfd-entity', 0, 0, 'Passenger')[0].type,
    'rectangle',
  );
  const store = symbolSkeletons('dfd-store', 0, 0, 'Reservations', {
    storeId: 'D1',
  });
  assert.equal(store[0].strokeColor, 'transparent');
  const visibleLines = store.filter((part) => part.type === 'line');
  assert.equal(visibleLines.length, 2);
  assert.ok(
    visibleLines.every((part) => part.points?.every((point) => point[1] === 0)),
  );
  assert.deepEqual(
    visibleLines.map((part) => part.y),
    [0, 72],
  );
  assert.ok(store.some((part) => part.text === 'D1  Reservations'));
  const flow = connectorSkeleton('data-flow', 0, 0, 200, 0, 'Booking data');
  assert.equal(flow.startArrowhead, null);
  assert.equal(flow.endArrowhead, 'arrow');
  assert.equal(flow.strokeStyle, 'solid');
  assert.equal(flow.label?.text, 'Booking data');
});

void test('DFD model and views survive save, merge and shared diagram duplication', () => {
  const project = dfdProject();
  assert.equal(project.nativeModel?.elements.length, 4);
  assert.equal(project.nativeModel?.relationships.length, 4);
  assert.ok(
    project.nativeModel?.relationships.every(
      (relationship) => relationship.kind === 'data-flow' && relationship.name,
    ),
  );
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.equal(
    reconcileNativeUmlScene(project, project.activeDiagramId),
    project,
  );
  assert.ok(
    !projectDiagnostics(project).some((diagnostic) =>
      diagnostic.code.startsWith('dfd.'),
    ),
  );
  const duplicated = duplicateDiagram(project, project.activeDiagramId);
  assert.equal(duplicated.nativeModel, project.nativeModel);
  assert.deepEqual(
    duplicated.diagrams[1].nativeElementIds,
    project.diagrams[0].nativeElementIds,
  );
  const merged = mergeProjects(project, project);
  assert.equal(merged.nativeModel?.elements.length, 8);
  assert.equal(
    new Set(merged.nativeModel?.elements.map((element) => element.id)).size,
    8,
  );
  assert.deepEqual(parseProject(JSON.stringify(merged)), merged);
});

void test('DFD critics identify unnamed flows, missing processes, disconnected nodes and process inputs/outputs', () => {
  let project = dfdProject();
  const passenger = project.nativeModel!.elements.find(
    (element) => element.kind === 'dfd-entity',
  )!;
  const store = project.nativeModel!.elements.find(
    (element) => element.kind === 'dfd-store',
  )!;
  project.diagrams[0].elements.push(
    ...converted(symbolSkeletons('dfd-process', 1000, 0, '3.0 Orphan process')),
  );
  project = reconcileNativeUmlScene(project, project.activeDiagramId);
  project.nativeModel!.relationships[0] = {
    ...project.nativeModel!.relationships[0],
    from: passenger.id,
    to: store.id,
    name: '',
  };
  const diagnostics = projectDiagnostics(project);
  for (const code of [
    'dfd.unnamed-flow',
    'dfd.missing-process',
    'dfd.disconnected-node',
    'dfd.process-io',
  ]) {
    const issue = diagnostics.find((diagnostic) => diagnostic.code === code);
    assert.equal(issue?.severity, 'warning', code);
    assert.ok(issue?.diagramIds.includes(project.activeDiagramId), code);
    assert.ok(issue?.nativeElementIds?.length, code);
  }
});

void test('object instance headers are underlined while multiline slot edits stay per view', () => {
  const slots = '- id = C001\n- name = "Ali"\n- phone = 123456';
  const skeletons = symbolSkeletons('object', 0, 0, 'customer : Customer', {
    slots,
  });
  const header = skeletons.find((part) => part.text === 'customer : Customer')!;
  const underline = skeletons.find(
    (part) => part.type === 'line' && part.x === header.x,
  )!;
  const body = skeletons.find((part) => part.text === slots)!;
  assert.ok(underline.y > header.y && underline.y < body.y);
  const sceneBody = converted([body])[0];
  assert.equal(nativeUmlMetadata(sceneBody)?.role, 'decor');
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'object';
  blank.diagrams[0].elements = converted(skeletons);
  let project = reconcileNativeUmlScene(blank, blank.activeDiagramId);
  const id = project.nativeModel!.elements[0].id;
  project = duplicateDiagram(project, project.activeDiagramId);
  project.diagrams[1].elements = project.diagrams[1].elements.map((element) =>
    element.text === slots
      ? { ...element, text: 'balance = 500', originalText: 'balance = 500' }
      : element,
  );
  project = reconcileNativeUmlScene(project, project.activeDiagramId);
  assert.equal(project.nativeModel!.elements[0].name, 'customer : Customer');
  project = updateNativeUmlElement(project, id, { name: 'buyer : Customer' });
  assert.ok(
    project.diagrams[0].elements.some((element) => element.text === slots),
  );
  assert.ok(
    project.diagrams[1].elements.some(
      (element) => element.text === 'balance = 500',
    ),
  );
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  const emptyName = symbolSkeletons('object', 0, 0, '', {
    slots: 'never the object name',
  });
  const empty = createBlankProject();
  empty.diagrams[0].elements = converted(emptyName);
  assert.equal(
    reconcileNativeUmlScene(empty, empty.activeDiagramId).nativeModel
      ?.elements[0].name,
    '',
  );
});

void test('drawing a two-point native self message is converted into a visible loop once', () => {
  const participant = symbolSkeletons('participant', 0, 0, 'Service');
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'sequence';
  const raw: SceneElement = {
    id: 'native-self',
    type: 'arrow',
    x: 85,
    y: 140,
    width: 0,
    height: 0,
    points: [
      [0, 0],
      [0, 0],
    ],
    startBinding: { elementId: participant[0].id },
    endBinding: { elementId: participant[0].id },
  };
  blank.diagrams[0].elements = [...converted(participant), raw];
  const project = reconcileNativeUmlScene(blank, blank.activeDiagramId, {
    connectorKind: 'self-message',
  });
  const loop = project.diagrams[0].elements.find(
    (element) => element.id === 'native-self',
  )!;
  assert.equal(loop.width, 90);
  assert.equal(loop.height, 44);
  assert.deepEqual(loop.points, [
    [0, 0],
    [90, 0],
    [90, 44],
    [0, 44],
  ]);
  assert.equal(
    reconcileNativeUmlScene(project, project.activeDiagramId),
    project,
  );
});

void test('sequence lifelines, destruction markers and self messages retain editable semantic identities', () => {
  const participant = symbolSkeletons('participant', 0, 0, 'Service', {
    lifelineHeight: 900,
  });
  const lifeline = participant.find((part) => part.type === 'line')!;
  assert.equal(lifeline.height, 900);
  assert.equal(lifeline.strokeStyle, 'dashed');
  assert.throws(
    () =>
      symbolSkeletons('participant', 0, 0, 'Invalid', {
        lifelineHeight: Infinity,
      }),
    /Lifeline height/,
  );
  const destruction = symbolSkeletons('destruction', 71, 950);
  const strokes = destruction.filter((part) => part.type === 'line');
  assert.equal(strokes.length, 2);
  assert.deepEqual(
    strokes.map((part) => part.points),
    [
      [
        [0, 0],
        [28, 28],
      ],
      [
        [0, 0],
        [-28, 28],
      ],
    ],
  );
  const self = connectorSkeleton(
    'message',
    85,
    140,
    85,
    140,
    'validate()',
    participant[0].id,
    participant[0].id,
  );
  assert.equal(self.points?.length, 4);
  assert.ok((self.width ?? 0) > 0 && (self.height ?? 0) > 0);
  assert.equal(self.endArrowhead, 'triangle');
  const explicit = connectorSkeleton(
    'self-message',
    85,
    200,
    85,
    200,
    'refresh()',
    participant[0].id,
    participant[0].id,
  );
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'sequence';
  blank.diagrams[0].elements = converted([
    ...participant,
    ...destruction,
    self,
    explicit,
  ]);
  const project = reconcileNativeUmlScene(blank, blank.activeDiagramId);
  assert.equal(project.nativeModel?.relationships.length, 2);
  assert.ok(
    project.nativeModel?.relationships.every(
      (relationship) => relationship.from === relationship.to,
    ),
  );
  assert.deepEqual(
    project.nativeModel?.relationships.map((relationship) => relationship.name),
    ['validate()', 'refresh()'],
  );
  assert.ok(
    project.nativeModel?.elements.some(
      (element) => element.kind === 'destruction',
    ),
  );
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.equal(
    reconcileNativeUmlScene(project, project.activeDiagramId),
    project,
  );
});
