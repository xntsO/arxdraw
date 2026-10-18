// In a running dev editor, run:
// await import('/scripts/native-runtime-check.js').then(m => m.checkNativeRuntime())
// Creates isolated in-memory projects and does not change the open workspace.
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import { createBlankProject, duplicateDiagram, parseProject } from '../lib/model';
import { diagramKinds, exampleSkeletons } from '../lib/practice';
import { reconcileNativeUmlScene, updateNativeUmlElement, updateNativeUmlRelationship } from '../lib/native-model';
import { renderProject } from '../lib/scene';

export function checkNativeRuntime() {
  let project = createBlankProject();
  const counts = [];
  for (const kind of diagramKinds) {
    const id = crypto.randomUUID();
    project = { ...project, activeDiagramId: id, diagrams: [...project.diagrams, {
      id, name: kind.label, kind: kind.id, classIds: [], relationshipIds: [],
      elements: convertToExcalidrawElements(exampleSkeletons(kind.id), { regenerateIds: false }),
    }] };
    project = reconcileNativeUmlScene(project, id);
    const diagram = project.diagrams.find((item) => item.id === id);
    counts.push({ kind: kind.id, nodes: diagram.nativeElementIds?.length ?? 0, edges: diagram.nativeRelationshipIds?.length ?? 0 });
  }
  project = parseProject(JSON.stringify(project));
  const useCase = project.diagrams.find((diagram) => diagram.kind === 'use-case');
  project = duplicateDiagram(project, useCase.id);
  const actor = project.nativeModel.elements.find((element) => element.kind === 'actor');
  const actorName = 'Customer service representative with a long name';
  project = renderProject(updateNativeUmlElement(project, actor.id, { name: actorName }));
  const labels = project.diagrams.flatMap((diagram) => diagram.elements.filter((element) =>
    element.type === 'text' && element.customData?.uml?.id === actor.id && element.customData.uml.role === 'name'));
  const arrow = project.nativeModel.relationships.find((relationship) => relationship.kind === 'association');
  project = renderProject(updateNativeUmlRelationship(project, arrow.id, { name: 'Uses service' }));
  const arrowLabels = project.diagrams.flatMap((diagram) => diagram.elements.filter((element) =>
    element.type === 'text' && element.customData?.uml?.id === arrow.id && element.text === 'Uses service'));
  const failures = [];
  if (counts.some((count) => count.nodes === 0)) failures.push('An example has no semantic symbols');
  if (labels.length !== 2 || labels.some((label) => label.text !== actorName || label.width < 250))
    failures.push('Shared native rename did not update and measure both views');
  if (arrowLabels.length !== 2) failures.push('Naming an unlabeled relationship did not create both bound labels');
  parseProject(JSON.stringify(project));
  return { pass: failures.length === 0, counts, renamedViews: labels.map((label) => ({ text: label.text, width: label.width })), arrowLabels: arrowLabels.length, failures };
}
