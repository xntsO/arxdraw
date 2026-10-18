import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  duplicateDiagram,
  mergeProjects,
  parseProject,
  projectDiagnostics,
  projectIssues,
} from '../lib/model.ts';
import { diagramSkeletons } from '../lib/diagram.ts';
import type { Project, SceneElement } from '../lib/model.ts';

void test('project boundary rejects null entries and malformed scene metadata without a property-access crash', () => {
  const mutations: ((project: Record<string, unknown>) => void)[] = [
    (project) => {
      project.relationships = [null];
    },
    (project) => {
      project.diagrams = [null];
    },
    (project) => {
      project.classes = [null];
    },
    (project) => {
      project.files = [];
    },
    (project) => {
      project.activeDiagramId = null;
    },
  ];
  for (const mutate of mutations) {
    const input: Record<string, unknown> = { ...createProject() };
    mutate(input);
    assert.throws(() => parseProject(JSON.stringify(input)), /valid ArxDraw/);
  }
  const malformed: unknown[] = [
    null,
    { id: '', type: 'rectangle', x: 0, y: 0, width: 1, height: 1 },
    { id: 'a', type: 'arrow', x: 0, y: 0, width: 1, height: 1, customData: [] },
    {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      customData: { modelId: {} },
    },
    {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      points: [[1, null]],
    },
    {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      startBinding: { elementId: [] },
    },
    {
      id: 'a',
      type: 'text',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      boundElements: [null],
    },
  ];
  for (const element of malformed) {
    const project = createProject();
    const diagram = { ...project.diagrams[0], elements: [element] };
    assert.throws(
      () => parseProject(JSON.stringify({ ...project, diagrams: [diagram] })),
      /valid ArxDraw/,
    );
  }
  const project = createProject();
  project.classes[0].id = ' ';
  assert.throws(() => parseProject(JSON.stringify(project)), /valid ArxDraw/);
  assert.throws(() => parseProject('{'), SyntaxError);
});

function withScene(): Project {
  const project = createProject();
  const diagram = project.diagrams[0];
  diagram.elements = [
    {
      id: 'uml-domain-user-box',
      type: 'rectangle',
      x: 33,
      y: 44,
      width: 250,
      height: 200,
      groupIds: ['uml-domain-user', 'outer'],
      customData: { modelId: 'user', role: 'box', arxdraw: true },
      boundElements: [
        { id: 'native-arrow', type: 'arrow' },
        { id: 'label', type: 'text' },
      ],
    },
    {
      id: 'uml-domain-order-box',
      type: 'rectangle',
      x: 500,
      y: 44,
      width: 250,
      height: 200,
      customData: { modelId: 'order', role: 'box', arxdraw: true },
    },
    {
      id: 'native-arrow',
      type: 'arrow',
      x: 283,
      y: 100,
      width: 217,
      height: 0,
      groupIds: ['outer'],
      points: [
        [0, 0],
        [217, 0],
      ],
      startBinding: { elementId: 'uml-domain-user-box', focus: 0, gap: 2 },
      endBinding: { elementId: 'uml-domain-order-box', focus: 0, gap: 2 },
    },
    {
      id: 'label',
      type: 'text',
      x: 40,
      y: 50,
      width: 100,
      height: 20,
      text: 'sketch',
      containerId: 'uml-domain-user-box',
      frameId: 'frame',
    },
    { id: 'frame', type: 'frame', x: 0, y: 0, width: 800, height: 500 },
    {
      id: 'image',
      type: 'image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fileId: 'embedded',
    },
    {
      id: 'rel-domain-places',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      customData: {
        relationshipId: 'places',
        from: 'user',
        to: 'order',
        arxdraw: true,
        manualRoute: true,
      },
      start: { id: 'uml-domain-user-box' },
      end: { id: 'uml-domain-order-box' },
    },
  ];
  project.files.embedded = {
    id: 'embedded',
    dataURL: 'data:image/png;base64,AA==',
    mimeType: 'image/png',
  };
  return project;
}
const reference = (element: SceneElement, key: string, idKey: string) => {
  const value = element[key];
  return value && typeof value === 'object'
    ? Object.entries(value).find(([key]) => key === idKey)?.[1]
    : undefined;
};
void test('duplicating a diagram preserves shared model and layout while remapping all native references', () => {
  const before = withScene(),
    snapshot = structuredClone(before);
  const after = duplicateDiagram(before, 'domain');
  const copied = after.diagrams[2];
  assert.deepEqual(before, snapshot);
  assert.equal(after.classes, before.classes);
  assert.equal(after.relationships, before.relationships);
  assert.equal(after.activeDiagramId, copied.id);
  assert.equal(copied.elements[0].id, `uml-${copied.id}-user-box`);
  assert.equal(copied.elements[0].x, 33);
  assert.equal(
    reference(copied.elements[2], 'startBinding', 'elementId'),
    copied.elements[0].id,
  );
  assert.equal(
    reference(copied.elements[2], 'endBinding', 'elementId'),
    copied.elements[1].id,
  );
  assert.equal(copied.elements[3].containerId, copied.elements[0].id);
  assert.equal(copied.elements[3].frameId, copied.elements[4].id);
  assert.equal(copied.elements[5].fileId, 'embedded');
  assert.equal(copied.elements[6].id, `rel-${copied.id}-places`);
  assert.equal(
    reference(copied.elements[6], 'start', 'id'),
    copied.elements[0].id,
  );
  assert.notDeepEqual(
    copied.elements[0].groupIds,
    before.diagrams[0].elements[0].groupIds,
  );
  assert.deepEqual(parseProject(JSON.stringify(after)), after);
  assert.equal(
    diagramSkeletons(after, copied).find(
      (element) => element.id === copied.elements[0].id,
    )?.x,
    33,
  );
  copied.elements[0].customData!.modelId = 'changed';
  assert.equal(before.diagrams[0].elements[0].customData?.modelId, 'user');
  assert.throws(() => duplicateDiagram(before, 'absent'), /not found/);
});

void test('merging colliding projects remaps model, generated scene IDs, native bindings and embedded images', () => {
  const current = withScene(),
    incoming = withScene();
  const snapshot = structuredClone(incoming);
  const merged = mergeProjects(current, incoming);
  assert.deepEqual(incoming, snapshot);
  assert.equal(merged.name, current.name);
  assert.equal(merged.classes.length, 8);
  assert.equal(new Set(merged.classes.map((item) => item.id)).size, 8);
  const diagram = merged.diagrams[2],
    box = diagram.elements[0],
    arrow = diagram.elements[6];
  const newClass = merged.classes[4],
    newRelationship = merged.relationships[3];
  assert.equal(box.customData?.modelId, newClass.id);
  assert.equal(box.id, `uml-${diagram.id}-${newClass.id}-box`);
  assert.equal(newRelationship.from, newClass.id);
  assert.equal(newRelationship.to, merged.classes[5].id);
  assert.equal(arrow.customData?.relationshipId, newRelationship.id);
  assert.equal(arrow.customData?.from, newClass.id);
  assert.equal(
    reference(diagram.elements[2], 'startBinding', 'elementId'),
    box.id,
  );
  assert.notEqual(diagram.elements[5].fileId, 'embedded');
  const fileId = diagram.elements[5].fileId;
  assert.equal(typeof fileId, 'string');
  assert.ok(typeof fileId === 'string' && Object.hasOwn(merged.files, fileId));
  assert.equal(merged.activeDiagramId, diagram.id);
  assert.deepEqual(merged.diagrams.slice(0, 2), current.diagrams);
  assert.deepEqual(parseProject(JSON.stringify(merged)), merged);
});

void test('merge and duplicate enforce diagram limits without mutating either input', () => {
  const project = createProject();
  project.diagrams = Array.from({ length: 100 }, (_, index) => ({
    ...project.diagrams[0],
    id: `d${index}`,
  }));
  project.activeDiagramId = 'd0';
  assert.throws(() => mergeProjects(project, createProject()), /limit/);
  assert.throws(() => duplicateDiagram(project, 'd0'), /100/);
  assert.equal(project.diagrams.length, 100);
});

void test('diagnostics have stable IDs, severities and navigable model/diagram references', () => {
  const project = createProject();
  project.classes[1].name = 'User';
  project.relationships[0].sourceMultiplicity = '8..2';
  project.relationships[2].kind = 'realization';
  project.relationships[2].to = 'user';
  const diagnostics = projectDiagnostics(project);
  assert.deepEqual(
    projectIssues(project),
    diagnostics.map((item) => item.message),
  );
  assert.deepEqual(projectDiagnostics(structuredClone(project)), diagnostics);
  assert.equal(
    new Set(diagnostics.map((item) => item.id)).size,
    diagnostics.length,
  );
  const duplicate = diagnostics.find(
    (item) => item.code === 'classifier.duplicate-name',
  );
  assert.equal(duplicate?.severity, 'warning');
  assert.deepEqual(duplicate?.classIds, ['user', 'order']);
  assert.deepEqual(duplicate?.diagramIds, ['domain', 'checkout']);
  const realization = diagnostics.find(
    (item) => item.code === 'realization.target',
  );
  assert.equal(realization?.severity, 'error');
  assert.deepEqual(realization?.relationshipIds, ['charges']);
  assert.ok(realization?.suggestion);
  assert.ok(
    diagnostics.some((item) => item.code === 'relationship.multiplicity'),
  );
});

void test('critics report affected inheritance-cycle links, invalid ownership and missing references', () => {
  const project = createProject();
  project.relationships = [
    {
      ...project.relationships[0],
      kind: 'inheritance',
      from: 'user',
      to: 'order',
    },
    {
      ...project.relationships[1],
      kind: 'inheritance',
      from: 'order',
      to: 'user',
    },
    {
      ...project.relationships[2],
      kind: 'composition',
      from: 'user',
      to: 'item',
    },
    {
      ...project.relationships[2],
      id: 'second-owner',
      kind: 'composition',
      from: 'order',
      to: 'item',
    },
    { ...project.relationships[2], id: 'broken', to: 'missing' },
  ];
  const diagnostics = projectDiagnostics(project);
  const cycle = diagnostics.find((item) => item.code === 'inheritance.cycle');
  assert.deepEqual(cycle?.classIds, ['user', 'order']);
  assert.deepEqual(cycle?.relationshipIds, ['places', 'contains']);
  assert.ok(
    diagnostics.some((item) => item.code === 'composition.multiple-owners'),
  );
  assert.ok(
    diagnostics.some((item) => item.code === 'relationship.missing-endpoint'),
  );
});
