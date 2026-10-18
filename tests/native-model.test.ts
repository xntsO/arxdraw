import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createBlankProject,
  duplicateDiagram,
  mergeProjects,
  parseProject,
  projectDiagnostics,
} from '../lib/model.ts';
import type { Diagram, Project, SceneElement } from '../lib/model.ts';
import {
  diagramKinds,
  exampleSkeletons,
  symbolSkeletons,
  connectorSkeleton,
} from '../lib/practice.ts';
import type { PracticeSkeleton } from '../lib/practice.ts';
import {
  nativeUmlMetadata,
  reconcileNativeUmlScene,
  updateNativeUmlElement,
  updateNativeUmlRelationship,
  nativeUmlViewSkeletons,
  removeNativeUmlElement,
  removeNativeUmlRelationship,
} from '../lib/native-model.ts';

// Model the converter boundary explicitly: generated bound text has no customData.
// No rendering or DOM shim is needed to exercise the actual semantic commands.
function converted(skeletons: PracticeSkeleton[]): SceneElement[] {
  const elements: SceneElement[] = [];
  for (const skeleton of skeletons) {
    elements.push({
      ...skeleton,
      width: skeleton.width ?? 100,
      height: skeleton.height ?? 20,
      ...(skeleton.text ? { originalText: skeleton.text } : {}),
      ...(skeleton.start
        ? { startBinding: { elementId: skeleton.start.id, focus: 0, gap: 1 } }
        : {}),
      ...(skeleton.end
        ? { endBinding: { elementId: skeleton.end.id, focus: 0, gap: 1 } }
        : {}),
    });
    if (skeleton.label)
      elements.push({
        id: `text-${skeleton.id}`,
        type: 'text',
        x: skeleton.x + 5,
        y: skeleton.y + 5,
        width: skeleton.width ?? 100,
        height: 20,
        text: skeleton.label.text,
        originalText: skeleton.label.text,
        containerId: skeleton.id,
        fontSize: skeleton.label.fontSize ?? 18,
      });
  }
  return elements;
}
function exampleProject(
  kind: Exclude<Diagram['kind'], 'class' | undefined>,
): Project {
  const project = createBlankProject();
  project.diagrams[0].kind = kind;
  project.diagrams[0].elements = converted(exampleSkeletons(kind));
  return reconcileNativeUmlScene(project, project.activeDiagramId);
}
void test('real Excalidraw-converted use-case fixture adopts bound labels and stable semantic identities', () => {
  const blank = createBlankProject();
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('./fixtures/native-example.json', import.meta.url),
      'utf8',
    ),
  );
  const project = parseProject(
    JSON.stringify({
      ...blank,
      diagrams: [{ ...blank.diagrams[0], kind: 'use-case', elements: raw }],
    }),
  );
  const adopted = reconcileNativeUmlScene(project, project.activeDiagramId);
  assert.equal(adopted.diagrams[0].elements.length, 22);
  assert.equal(adopted.nativeModel?.elements.length, 6);
  assert.equal(adopted.nativeModel?.relationships.length, 4);
  assert.equal(
    reconcileNativeUmlScene(adopted, adopted.activeDiagramId),
    adopted,
  );
  const useCase = adopted.nativeModel!.elements.find(
    (element) => element.name === 'Checkout',
  )!;
  const renamed = updateNativeUmlElement(adopted, useCase.id, {
    name: 'Complete purchase',
  });
  assert.ok(
    renamed.diagrams[0].elements.some(
      (element) => element.text === 'Complete purchase',
    ),
  );
  assert.deepEqual(parseProject(JSON.stringify(renamed)), renamed);
});
void test('all native examples register finite semantic kinds, links and bound names and round trip as v1', () => {
  for (const kind of diagramKinds) {
    const project = exampleProject(kind.id);
    assert.ok(
      project.nativeModel && project.nativeModel.elements.length > 1,
      kind.id,
    );
    assert.ok(project.nativeModel.relationships.length > 0, kind.id);
    const ids = new Set(
      project.nativeModel.elements.map((element) => element.id),
    );
    assert.ok(
      project.nativeModel.relationships.every(
        (relationship) =>
          ids.has(relationship.from) && ids.has(relationship.to),
      ),
      kind.id,
    );
    assert.equal(
      project.diagrams[0].nativeElementIds?.length,
      project.nativeModel.elements.length,
    );
    assert.deepEqual(parseProject(JSON.stringify(project)), project);
    assert.equal(
      reconcileNativeUmlScene(project, project.activeDiagramId),
      project,
      `${kind.id} is idempotent`,
    );
    assert.ok(
      project.diagrams[0].elements.every(
        (element) => !element.customData?.arxdraw,
      ),
    );
  }
});

void test('old unannotated symbols and arrows retain their freehand behavior', () => {
  const project = createBlankProject();
  project.diagrams[0].kind = 'use-case';
  project.diagrams[0].elements = converted(symbolSkeletons('actor', 0, 0)).map(
    (element) => ({ ...element, customData: undefined }),
  );
  assert.equal(
    reconcileNativeUmlScene(project, project.activeDiagramId),
    project,
  );
  assert.equal(project.nativeModel, undefined);
  assert.deepEqual(
    parseProject(JSON.stringify(createBlankProject())).nativeModel,
    undefined,
  );
});

void test('shared native names and documentation propagate across diagrams from Properties and canvas edits', () => {
  let project = exampleProject('component');
  const component = project.nativeModel!.elements.find(
    (element) => element.kind === 'component',
  )!;
  const second = {
    id: 'other',
    name: 'Other',
    kind: 'component' as const,
    classIds: [],
    relationshipIds: [],
    elements: converted(
      nativeUmlViewSkeletons(project, component.id, 900, 300),
    ),
  };
  project = reconcileNativeUmlScene(
    { ...project, diagrams: [...project.diagrams, second] },
    second.id,
  );
  const snapshot = structuredClone(project);
  project = updateNativeUmlElement(project, component.id, {
    name: 'Payment boundary',
    description: 'Shared documentation',
  });
  assert.equal(
    project.nativeModel?.elements.find((element) => element.id === component.id)
      ?.description,
    'Shared documentation',
  );
  for (const diagram of project.diagrams) {
    const label = diagram.elements.find(
      (element) =>
        nativeUmlMetadata(element)?.id === component.id &&
        nativeUmlMetadata(element)?.role === 'name',
    );
    assert.equal(label?.text, '«component»\nPayment boundary');
    assert.equal(label?.originalText, label?.text);
  }
  assert.notDeepEqual(snapshot, project);
  const active = project.diagrams[1];
  active.elements = active.elements.map((element) =>
    nativeUmlMetadata(element)?.id === component.id &&
    nativeUmlMetadata(element)?.role === 'name'
      ? {
          ...element,
          text: '«component»\nBilling',
          originalText: '«component»\nBilling',
        }
      : element,
  );
  project = reconcileNativeUmlScene(project, active.id);
  assert.equal(
    project.nativeModel?.elements.find((element) => element.id === component.id)
      ?.name,
    'Billing',
  );
  assert.ok(
    project.diagrams[0].elements.some(
      (element) => element.text === '«component»\nBilling',
    ),
  );
  assert.equal(reconcileNativeUmlScene(project, active.id), project);
});

void test('editing text defers semantic rename until the edit ends', () => {
  const project = exampleProject('use-case');
  const actor = project.nativeModel!.elements.find(
    (element) => element.kind === 'actor',
  )!;
  const changed = {
    ...project,
    diagrams: project.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        nativeUmlMetadata(element)?.id === actor.id &&
        nativeUmlMetadata(element)?.role === 'name'
          ? { ...element, text: 'Typing', originalText: 'Typing' }
          : element,
      ),
    })),
  };
  assert.equal(
    reconcileNativeUmlScene(changed, project.activeDiagramId, {
      editingText: true,
    }),
    changed,
  );
  const finished = reconcileNativeUmlScene(changed, project.activeDiagramId);
  assert.equal(
    finished.nativeModel?.elements.find((element) => element.id === actor.id)
      ?.name,
    'Typing',
  );
});

function copySelection(elements: SceneElement[]): SceneElement[] {
  return elements.map((element) => ({
    ...structuredClone(element),
    id: `copy-${element.id}`,
    x: element.x + 1000,
    ...(Array.isArray(element.groupIds)
      ? {
          groupIds: element.groupIds.map(
            (group: unknown) =>
              `copy-${typeof group === 'string' ? group : ''}`,
          ),
        }
      : {}),
    ...(typeof element.containerId === 'string'
      ? { containerId: `copy-${element.containerId}` }
      : {}),
    ...(element.startBinding &&
    typeof element.startBinding === 'object' &&
    'elementId' in element.startBinding &&
    typeof element.startBinding.elementId === 'string'
      ? {
          startBinding: {
            ...element.startBinding,
            elementId: `copy-${element.startBinding.elementId}`,
          },
        }
      : {}),
    ...(element.endBinding &&
    typeof element.endBinding === 'object' &&
    'elementId' in element.endBinding &&
    typeof element.endBinding.elementId === 'string'
      ? {
          endBinding: {
            ...element.endBinding,
            elementId: `copy-${element.endBinding.elementId}`,
          },
        }
      : {}),
  }));
}
void test('native selection duplication clones elements and links with fresh identities, then stays stable', () => {
  const project = exampleProject('object');
  const scene = project.diagrams[0].elements;
  project.diagrams[0].elements = [...scene, ...copySelection(scene)];
  const count = project.nativeModel!.elements.length,
    linkCount = project.nativeModel!.relationships.length;
  const copied = reconcileNativeUmlScene(project, project.activeDiagramId);
  assert.equal(copied.nativeModel?.elements.length, count * 2);
  assert.equal(copied.nativeModel?.relationships.length, linkCount * 2);
  const copiedIds = new Set(
    copied.nativeModel!.elements.slice(count).map((element) => element.id),
  );
  assert.ok(
    copied
      .nativeModel!.relationships.slice(linkCount)
      .every(
        (relationship) =>
          copiedIds.has(relationship.from) && copiedIds.has(relationship.to),
      ),
  );
  assert.ok(
    copied
      .nativeModel!.elements.slice(count)
      .every((element) => element.name.endsWith(' 2')),
  );
  assert.equal(reconcileNativeUmlScene(copied, copied.activeDiagramId), copied);
  assert.deepEqual(parseProject(JSON.stringify(copied)), copied);
});

void test('native diagram duplication shares model identity; merge remaps all native identities and preserves scenes', () => {
  const project = exampleProject('use-case');
  const duplicated = duplicateDiagram(project, project.activeDiagramId);
  assert.equal(duplicated.nativeModel, project.nativeModel);
  assert.deepEqual(
    duplicated.diagrams[1].nativeElementIds,
    project.diagrams[0].nativeElementIds,
  );
  assert.equal(
    reconcileNativeUmlScene(duplicated, duplicated.activeDiagramId),
    duplicated,
  );
  const merged = mergeProjects(project, project);
  const originalIds = new Set(
    project.nativeModel!.elements.map((element) => element.id),
  );
  assert.ok(
    merged
      .nativeModel!.elements.slice(originalIds.size)
      .every((element) => !originalIds.has(element.id)),
  );
  const importedIds = new Set(merged.diagrams[1].nativeElementIds);
  assert.ok(
    merged
      .nativeModel!.relationships.slice(
        project.nativeModel!.relationships.length,
      )
      .every(
        (relationship) =>
          importedIds.has(relationship.from) &&
          importedIds.has(relationship.to),
      ),
  );
  assert.deepEqual(parseProject(JSON.stringify(merged)), merged);
  assert.equal(reconcileNativeUmlScene(merged, merged.activeDiagramId), merged);
});

void test('copies inserted before originals keep the original semantic nodes and relationship endpoints intact', () => {
  const project = exampleProject('object');
  const originalModel = structuredClone(project.nativeModel);
  const scene = project.diagrams[0].elements;
  project.diagrams[0].elements = [...copySelection(scene), ...scene];
  const reconciled = reconcileNativeUmlScene(project, project.activeDiagramId);
  assert.deepEqual(
    reconciled.nativeModel?.elements.slice(0, originalModel?.elements.length),
    originalModel?.elements,
  );
  assert.deepEqual(
    reconciled.nativeModel?.relationships.slice(
      0,
      originalModel?.relationships.length,
    ),
    originalModel?.relationships,
  );
  for (const element of scene) {
    const originalMetadata = nativeUmlMetadata(element);
    assert.equal(
      nativeUmlMetadata(
        reconciled.diagrams[0].elements.find((item) => item.id === element.id)!,
      )?.id,
      originalMetadata?.id,
    );
  }
  assert.equal(
    reconcileNativeUmlScene(reconciled, reconciled.activeDiagramId),
    reconciled,
  );
});

void test('native view deletion preserves the shared model; explicit model deletion cascades everywhere', () => {
  const project = exampleProject('object');
  const duplicated = duplicateDiagram(project, project.activeDiagramId);
  const id = project.nativeModel!.elements[0].id;
  const removed = removeNativeUmlElement(
    duplicated,
    duplicated.activeDiagramId,
    id,
  );
  assert.equal(removed.nativeModel, duplicated.nativeModel);
  assert.ok(removed.diagrams[0].nativeElementIds?.includes(id));
  assert.ok(!removed.diagrams[1].nativeElementIds?.includes(id));
  assert.ok(
    removed.diagrams[1].elements.every(
      (element) => nativeUmlMetadata(element)?.id !== id,
    ),
  );
  const deleted = removeNativeUmlElement(
    duplicated,
    duplicated.activeDiagramId,
    id,
    true,
  );
  assert.ok(
    !deleted.nativeModel?.elements.some((element) => element.id === id),
  );
  assert.ok(
    deleted.nativeModel?.relationships.every(
      (relationship) => relationship.from !== id && relationship.to !== id,
    ),
  );
  assert.deepEqual(parseProject(JSON.stringify(deleted)), deleted);
  const edge = project.nativeModel!.relationships[0];
  const renamed = updateNativeUmlRelationship(project, edge.id, {
    name: 'connected',
    description: 'A shared link',
  });
  assert.equal(renamed.nativeModel!.relationships[0].name, 'connected');
  assert.ok(
    renamed.diagrams[0].elements.some(
      (element) => element.text === 'connected',
    ),
  );
  assert.ok(
    !removeNativeUmlRelationship(
      project,
      project.activeDiagramId,
      edge.id,
      true,
    ).nativeModel?.relationships.some(
      (relationship) => relationship.id === edge.id,
    ),
  );
});

void test('seeded and explicit UML connectors acquire semantics; plain native arrows stay free', () => {
  const project = createBlankProject(),
    diagram = project.diagrams[0];
  diagram.kind = 'use-case';
  const actor = symbolSkeletons('actor', 0, 0),
    useCase = symbolSkeletons('use-case', 300, 0);
  const arrow = connectorSkeleton(
    'association',
    90,
    50,
    300,
    50,
    'uses',
    actor[0].id,
    useCase[0].id,
  );
  diagram.elements = converted([...actor, ...useCase, arrow]);
  let adopted = reconcileNativeUmlScene(project, diagram.id);
  assert.equal(adopted.nativeModel?.relationships.length, 1);
  const free = {
    ...adopted.diagrams[0].elements.find(
      (element) => element.type === 'arrow',
    )!,
    id: 'plain',
    customData: undefined,
  };
  adopted = {
    ...adopted,
    diagrams: [
      {
        ...adopted.diagrams[0],
        elements: [...adopted.diagrams[0].elements, free],
      },
    ],
  };
  assert.equal(reconcileNativeUmlScene(adopted, diagram.id), adopted);
  assert.equal(
    reconcileNativeUmlScene(adopted, diagram.id, {
      connectorKind: 'association',
    }).nativeModel?.relationships.length,
    2,
  );
});

void test('native parser enforces model endpoints and kinds; critics carry native navigation references', () => {
  const project = exampleProject('state');
  const invalid = structuredClone(project);
  invalid.nativeModel!.relationships[0].to = 'missing';
  assert.throws(() => parseProject(JSON.stringify(invalid)), /valid ArxDraw/);
  const initial = project.nativeModel!.elements.find(
    (element) => element.kind === 'initial',
  )!;
  const noInitial = removeNativeUmlElement(
    project,
    project.activeDiagramId,
    initial.id,
  );
  assert.ok(
    projectDiagnostics(noInitial).some(
      (diagnostic) =>
        diagnostic.code === 'native.missing-initial' &&
        diagnostic.diagramIds.includes(project.activeDiagramId),
    ),
  );
  const final = project.nativeModel!.elements.find(
    (element) => element.kind === 'final',
  )!;
  const outgoing = structuredClone(project);
  outgoing.nativeModel!.relationships[0].from = final.id;
  assert.ok(
    projectDiagnostics(outgoing).some(
      (diagnostic) =>
        diagnostic.code === 'native.final-outgoing' &&
        diagnostic.nativeElementIds?.includes(final.id),
    ),
  );
});

void test('an ungrouped copied use case owns its bound label and canvas edits rename only the copy', () => {
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'use-case';
  blank.diagrams[0].elements = converted(
    symbolSkeletons('use-case', 0, 0, 'Pay'),
  );
  const original = reconcileNativeUmlScene(blank, blank.activeDiagramId);
  const scene = original.diagrams[0].elements;
  const duplicated = reconcileNativeUmlScene(
    {
      ...original,
      diagrams: [
        {
          ...original.diagrams[0],
          elements: [...scene, ...copySelection(scene)],
        },
      ],
    },
    original.activeDiagramId,
  );
  const copy = duplicated.nativeModel!.elements[1];
  const copyLabel = duplicated.diagrams[0].elements.find(
    (element) => element.id.startsWith('copy-') && element.type === 'text',
  )!;
  assert.equal(nativeUmlMetadata(copyLabel)?.id, copy.id);
  assert.equal(copyLabel.originalText, 'Pay 2');
  assert.equal(copyLabel.customData?.umlNeedsMeasure, true);
  const edited = {
    ...duplicated,
    diagrams: [
      {
        ...duplicated.diagrams[0],
        elements: duplicated.diagrams[0].elements.map((element) =>
          element.id === copyLabel.id
            ? { ...element, text: 'Refund', originalText: 'Refund' }
            : element,
        ),
      },
    ],
  };
  const renamed = reconcileNativeUmlScene(edited, edited.activeDiagramId);
  assert.equal(renamed.nativeModel!.elements[0].name, 'Pay');
  assert.equal(renamed.nativeModel!.elements[1].name, 'Refund');
  assert.equal(
    reconcileNativeUmlScene(renamed, renamed.activeDiagramId),
    renamed,
  );
});

void test('wrapped real labels adopt their unwrapped originalText and do not change on unrelated edits', () => {
  const blank = createBlankProject();
  const raw: unknown = JSON.parse(
    readFileSync(
      new URL('./fixtures/native-example.json', import.meta.url),
      'utf8',
    ),
  );
  const project = reconcileNativeUmlScene(
    parseProject(
      JSON.stringify({
        ...blank,
        diagrams: [{ ...blank.diagrams[0], kind: 'use-case', elements: raw }],
      }),
    ),
    blank.activeDiagramId,
  );
  const diagram = project.diagrams[0];
  for (const label of diagram.elements.filter(
    (element) =>
      element.type === 'text' && typeof element.containerId === 'string',
  ))
    assert.equal(nativeUmlMetadata(label)?.role, 'name');
  const browse = project.nativeModel!.elements.find(
    (element) => element.name === 'Browse products',
  )!;
  const wrapped = diagram.elements.find(
    (element) =>
      nativeUmlMetadata(element)?.id === browse.id && element.type === 'text',
  )!;
  assert.equal(wrapped.text, 'Browse\nproducts');
  const documented = updateNativeUmlElement(project, browse.id, {
    description: 'Updated documentation',
  });
  assert.equal(
    documented.diagrams[0].elements.find(
      (element) => element.id === wrapped.id,
    ),
    wrapped,
  );
  const renamed = updateNativeUmlElement(documented, browse.id, {
    name: 'Search catalog',
  });
  assert.equal(
    renamed.diagrams[0].elements.find((element) => element.id === wrapped.id)
      ?.originalText,
    'Search catalog',
  );
});

void test('rebinding a relationship shared across diagrams forks identity and cannot be reverted by a stale view', () => {
  const initial = exampleProject('use-case');
  const project = duplicateDiagram(initial, initial.activeDiagramId);
  const old = project.nativeModel!.relationships[0];
  const first = project.diagrams[0];
  const target = first.elements.find(
    (element) =>
      nativeUmlMetadata(element)?.role === 'node' &&
      nativeUmlMetadata(element)?.kind === 'use-case' &&
      nativeUmlMetadata(element)?.id !== old.to,
  )!;
  first.elements = first.elements.map((element) =>
    element.type === 'arrow' && nativeUmlMetadata(element)?.id === old.id
      ? { ...element, endBinding: { elementId: target.id, focus: 0, gap: 2 } }
      : element,
  );
  const rebound = reconcileNativeUmlScene(project, first.id);
  assert.deepEqual(rebound.nativeModel!.relationships[0], old);
  const fork = rebound.nativeModel!.relationships.at(-1)!;
  assert.notEqual(fork.id, old.id);
  assert.equal(fork.to, nativeUmlMetadata(target)?.id);
  assert.ok(!rebound.diagrams[0].nativeRelationshipIds?.includes(old.id));
  assert.equal(
    reconcileNativeUmlScene(rebound, rebound.diagrams[1].id),
    rebound,
  );
  assert.equal(reconcileNativeUmlScene(rebound, first.id), rebound);
});

void test('merging unregistered seeds twice assigns independent identities and malformed stamps retain drawings', () => {
  const seed = createBlankProject();
  seed.diagrams[0].kind = 'use-case';
  seed.diagrams[0].elements = converted(
    symbolSkeletons('use-case', 0, 0, 'Seed'),
  );
  const first = mergeProjects(createBlankProject(), seed);
  const second = mergeProjects(first, seed);
  const sourceId = nativeUmlMetadata(seed.diagrams[0].elements[0])?.id;
  const firstId = nativeUmlMetadata(second.diagrams[1].elements[0])?.id;
  const secondId = nativeUmlMetadata(second.diagrams[2].elements[0])?.id;
  assert.notEqual(firstId, sourceId);
  assert.notEqual(secondId, sourceId);
  assert.notEqual(firstId, secondId);
  const adopted = reconcileNativeUmlScene(
    reconcileNativeUmlScene(second, second.diagrams[1].id),
    second.diagrams[2].id,
  );
  assert.equal(adopted.nativeModel?.elements.length, 2);
  const malformed = structuredClone(seed);
  malformed.diagrams[0].elements[0].customData = {
    uml: { id: null, kind: 'unknown' },
    userData: 'keep',
  };
  const recovered = parseProject(JSON.stringify(malformed));
  assert.equal(recovered.diagrams[0].elements[0].customData?.uml, undefined);
  assert.equal(recovered.diagrams[0].elements[0].customData?.userData, 'keep');
  assert.equal(
    recovered.diagrams[0].elements[0].x,
    seed.diagrams[0].elements[0].x,
  );
});
