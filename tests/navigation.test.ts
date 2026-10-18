import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject,
  parseProject,
  duplicateDiagram,
  mergeProjects,
} from '../lib/model.ts';
import { diagramSkeletons } from '../lib/diagram.ts';
import {
  exportClassPlantUml,
  importClassPlantUml,
  exportClassXmi,
} from '../lib/interchange.ts';
import { reconcileClassRelationships } from '../lib/scene-model.ts';
import {
  connectorSkeleton,
  practiceTools,
  symbolSkeletons,
} from '../lib/practice.ts';
import type { SceneElement } from '../lib/model.ts';

void test('directed class associations preserve navigation in scene, project operations and PlantUML', () => {
  const project = createProject();
  project.relationships[0].navigable = 'target';
  const arrow = diagramSkeletons(project, project.diagrams[0]).find(
    (element) =>
      element.customData.relationshipId === 'places' &&
      element.type === 'arrow',
  )!;
  assert.equal(arrow.endArrowhead, 'arrow');
  assert.equal(arrow.startArrowhead, null);
  assert.equal(
    parseProject(JSON.stringify(project)).relationships[0].navigable,
    'target',
  );
  assert.equal(
    duplicateDiagram(project, 'domain').relationships[0].navigable,
    'target',
  );
  assert.equal(
    mergeProjects(project, project).relationships[3].navigable,
    'target',
  );
  const imported = importClassPlantUml(exportClassPlantUml(project));
  assert.equal(imported.relationships[0].navigable, 'target');
  const reverse = importClassPlantUml('class A\nclass B\nA <-- B');
  assert.equal(reverse.relationships[0].navigable, 'target');
  assert.equal(
    reverse.classes.find((item) => item.id === reverse.relationships[0].from)
      ?.name,
    'B',
  );
  assert.throws(
    () => exportClassXmi(project),
    /navigability export is not supported/,
  );
  const invalid = {
    ...project,
    relationships: project.relationships.map((relationship, index) =>
      index === 0 ? { ...relationship, navigable: 'both' } : relationship,
    ),
  };
  assert.throws(() => parseProject(JSON.stringify(invalid)), /valid ArxDraw/);
});

void test('ordinary native arrow association captures navigation and removing its arrowhead clears it', () => {
  const project = createProject(),
    diagram = project.diagrams[0];
  const box = (id: string, modelId: string): SceneElement => ({
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 250,
    height: 200,
    customData: { arxdraw: true, modelId, role: 'box' },
  });
  diagram.elements = [
    box('a', 'user'),
    box('b', 'order'),
    {
      id: 'new-arrow',
      type: 'arrow',
      x: 0,
      y: 0,
      width: 200,
      height: 10,
      startBinding: { elementId: 'a' },
      endBinding: { elementId: 'b' },
      endArrowhead: 'arrow',
      strokeStyle: 'solid',
    },
  ];
  const linked = reconcileClassRelationships(project, diagram.id);
  assert.equal(linked.relationships.at(-1)?.navigable, 'target');
  const cleared = {
    ...linked,
    diagrams: linked.diagrams.map((item) =>
      item.id === diagram.id
        ? {
            ...item,
            elements: item.elements.map((element) =>
              element.id === 'new-arrow'
                ? { ...element, endArrowhead: null }
                : element,
            ),
          }
        : item,
    ),
  };
  assert.equal(
    reconcileClassRelationships(cleared, diagram.id).relationships.at(-1)
      ?.navigable,
    undefined,
  );
});

void test('lab palettes expose uni-associations, component actors, folded notes and dashed note anchors', () => {
  assert.ok(
    practiceTools('use-case').some(
      (tool) => tool.id === 'directed-association',
    ),
  );
  assert.ok(practiceTools('component').some((tool) => tool.id === 'actor'));
  assert.ok(
    practiceTools('communication').some((tool) => tool.id === 'self-message'),
  );
  const directed = connectorSkeleton('directed-association', 0, 0, 200, 0);
  assert.equal(directed.endArrowhead, 'arrow');
  assert.equal(directed.strokeStyle, 'solid');
  const note = symbolSkeletons('note', 0, 0, 'Registration policy');
  assert.equal(note[0].strokeColor, 'transparent');
  assert.ok(note.some((element) => element.text === 'Registration policy'));
  assert.ok(
    note.some((element) => element.points?.some((point) => point[0] === 195)),
  );
  const anchor = connectorSkeleton('note-link', 0, 0, 200, 0);
  assert.equal(anchor.strokeStyle, 'dashed');
  assert.equal(anchor.endArrowhead, null);
  const required = symbolSkeletons('required-interface', 0, 0, 'IPayment');
  assert.equal(required[0].type, 'rectangle');
  assert.equal(required[0].strokeColor, 'transparent');
  const self = connectorSkeleton(
    'numbered-message',
    100,
    100,
    100,
    100,
    '5: calculate fine',
    'librarian',
    'librarian',
  );
  assert.equal(self.points?.length, 4);
  assert.ok((self.height ?? 0) > 0);
});

void test('lab identity is optional, survives copying and sanitizes malformed external values', () => {
  const project = createProject();
  project.diagrams[0].labId = 'practice-sequence-3';
  assert.equal(
    parseProject(JSON.stringify(project)).diagrams[0].labId,
    'practice-sequence-3',
  );
  assert.equal(
    duplicateDiagram(project, 'domain').diagrams[2].labId,
    'practice-sequence-3',
  );
  assert.equal(
    mergeProjects(project, project).diagrams[2].labId,
    'practice-sequence-3',
  );
  const invalid = {
    ...project,
    diagrams: project.diagrams.map((diagram, index) =>
      index === 0 ? { ...diagram, labId: { unexpected: true } } : diagram,
    ),
  };
  assert.equal(
    parseProject(JSON.stringify(invalid)).diagrams[0].labId,
    undefined,
  );
});
