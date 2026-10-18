import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import { createBlankProject, duplicateDiagram } from '../../lib/model.ts';
import {
  connectorSkeleton,
  exampleSkeletons,
  symbolSkeletons,
} from '../../lib/practice.ts';
import {
  nativeUmlMetadata,
  reconcileNativeUmlScene,
  updateNativeUmlElement,
  updateNativeUmlRelationship,
} from '../../lib/native-model.ts';
import { renderProject } from '../../lib/scene.ts';

/** Run in the dev browser with import('/tests/runtime/native-render-browser.ts'). */
export function verifyNativeRendering() {
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'use-case';
  blank.diagrams[0].elements = convertToExcalidrawElements(
    exampleSkeletons('use-case') as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  );
  let project = renderProject(
    reconcileNativeUmlScene(blank, blank.activeDiagramId),
  );
  const actor = project.nativeModel?.elements.find(
    (element) => element.kind === 'actor',
  );
  if (!actor) throw new Error('Actor registration failed.');
  const original = project.diagrams[0].elements.find(
    (element) =>
      nativeUmlMetadata(element)?.id === actor.id &&
      nativeUmlMetadata(element)?.role === 'name',
  );
  if (!original) throw new Error('Actor name binding failed.');
  project = duplicateDiagram(project, project.activeDiagramId);
  project.diagrams[0].elements.push({
    id: 'freehand-preservation',
    type: 'rectangle',
    x: 1370,
    y: 500,
    width: 120,
    height: 100,
    strokeColor: '#f00',
  });
  project = renderProject(
    updateNativeUmlElement(project, actor.id, {
      name: 'Customer account representative',
    }),
  );
  const labels = project.diagrams.map((diagram) =>
    diagram.elements.find(
      (element) =>
        nativeUmlMetadata(element)?.id === actor.id &&
        nativeUmlMetadata(element)?.role === 'name',
    ),
  );
  if (
    !labels.every(
      (label) =>
        label?.text === 'Customer account representative' &&
        label.width > original.width,
    )
  )
    throw new Error(
      'Shared actor rename did not refresh both text dimensions.',
    );
  const association = project.nativeModel?.relationships.find(
    (relationship) => relationship.kind === 'association' && !relationship.name,
  );
  if (!association) throw new Error('Expected an unlabeled association.');
  project = renderProject(
    updateNativeUmlRelationship(project, association.id, {
      name: 'uses account',
    }),
  );
  const boundLabels = project.diagrams.map((diagram) => {
    const arrow = diagram.elements.find(
      (element) =>
        nativeUmlMetadata(element)?.id === association.id &&
        element.type === 'arrow',
    );
    const label = diagram.elements.find(
      (element) =>
        nativeUmlMetadata(element)?.id === association.id &&
        element.type === 'text',
    );
    if (
      !arrow ||
      !label ||
      label.text !== 'uses account' ||
      label.containerId !== arrow.id ||
      !Array.isArray(arrow.boundElements) ||
      !arrow.boundElements.some(
        (bound: unknown) =>
          typeof bound === 'object' &&
          bound !== null &&
          'id' in bound &&
          bound.id === label.id,
      )
    )
      throw new Error(
        'Naming an unlabeled association did not create reciprocal bound text.',
      );
    return {
      width: label.width,
      height: label.height,
      containerId: label.containerId,
    };
  });
  const freehand = project.diagrams[0].elements.find(
    (element) => element.id === 'freehand-preservation',
  );
  if (
    !freehand ||
    freehand.x !== 1370 ||
    freehand.y !== 500 ||
    freehand.width !== 120 ||
    freehand.height !== 100
  )
    throw new Error('Refreshing native names changed freehand geometry.');
  return {
    diagrams: project.diagrams.length,
    originalWidth: original.width,
    renamedWidths: labels.map((label) => label?.width),
    boundLabels,
    freehandPreserved: true,
  };
}

/** Real converter check for the COMP371 palette additions. */
export function verifyLabNotation() {
  const blank = createBlankProject();
  blank.diagrams[0].kind = 'data-flow';
  blank.diagrams[0].elements = convertToExcalidrawElements(
    exampleSkeletons('data-flow') as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  );
  const dfd = renderProject(
    reconcileNativeUmlScene(blank, blank.activeDiagramId),
  );
  if (
    dfd.nativeModel?.elements.length !== 4 ||
    dfd.nativeModel.relationships.length !== 4
  )
    throw new Error('DFD example did not register its semantic model.');
  const participant = symbolSkeletons('participant', 0, 0, 'Service', {
    lifelineHeight: 900,
  });
  const self = connectorSkeleton(
    'self-message',
    85,
    160,
    85,
    160,
    'validate()',
    participant[0].id,
    participant[0].id,
  );
  const sequence = convertToExcalidrawElements(
    [
      ...participant,
      self,
      ...symbolSkeletons('destruction', 71, 950),
    ] as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  );
  const arrow = sequence.find((element) => element.type === 'arrow');
  if (
    !arrow ||
    !('points' in arrow) ||
    arrow.points.length < 4 ||
    arrow.width <= 0 ||
    arrow.height <= 0
  )
    throw new Error('Self-message collapsed during Excalidraw conversion.');
  const slots = 'id = C001\nname = "Ali"\nbalance = 500';
  const object = convertToExcalidrawElements(
    symbolSkeletons('object', 0, 0, 'customer : Customer', {
      slots,
    }) as ExcalidrawElementSkeleton[],
    { regenerateIds: false },
  );
  const slotText = object.find(
    (element) => element.type === 'text' && element.originalText === slots,
  );
  if (
    !slotText ||
    slotText.height < 50 ||
    nativeUmlMetadata(slotText)?.role !== 'decor'
  )
    throw new Error('Object slot compartment is missing or treated as a name.');
  const objectProject = createBlankProject();
  objectProject.diagrams[0].kind = 'object';
  objectProject.diagrams[0].elements = object;
  let renderedObject = renderProject(
    reconcileNativeUmlScene(objectProject, objectProject.activeDiagramId),
  );
  const objectId = renderedObject.nativeModel!.elements[0].id;
  renderedObject = renderProject(
    updateNativeUmlElement(renderedObject, objectId, { name: 'o : Order' }),
  );
  const header = renderedObject.diagrams[0].elements.find(
    (element) => nativeUmlMetadata(element)?.role === 'name',
  )!;
  const underline = renderedObject.diagrams[0].elements.find(
    (element) => element.type === 'line' && element.x === header.x,
  )!;
  if (
    Math.abs(header.width - underline.width) > 1 ||
    !renderedObject.diagrams[0].elements.some(
      (element) => element.originalText === slots,
    )
  )
    throw new Error(
      'Object underline did not follow the measured header or slots changed.',
    );
  return {
    dfdElements: dfd.nativeModel.elements.length,
    dfdFlows: dfd.nativeModel.relationships.length,
    selfMessagePoints: arrow.points,
    selfMessageSize: [arrow.width, arrow.height],
    objectSlotsHeight: slotText.height,
    objectHeaderWidth: header.width,
    objectUnderlineWidth: underline.width,
  };
}
