import { projectDiagnostics } from './diagnostics.ts';
import type { NativeUmlModel } from './native-model-types.ts';
export type {
  NativeUmlElement,
  NativeUmlRelationship,
  NativeElementKind,
  NativeRelationshipKind,
  NativeUmlModel,
  NativeUmlMetadata,
} from './native-model-types.ts';
export type Classifier = {
  id: string;
  name: string;
  kind: 'class' | 'interface' | 'abstract';
  attributes: string;
  operations: string;
  description: string;
};
export const relationshipKinds = [
  'association',
  'aggregation',
  'composition',
  'inheritance',
  'dependency',
  'realization',
] as const;
export type Relationship = {
  id: string;
  from: string;
  to: string;
  kind: (typeof relationshipKinds)[number];
  label: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
  navigable?: 'target';
};
export type SceneElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  strokeColor?: string;
  backgroundColor?: string;
  customData?: {
    arxdraw?: boolean;
    modelId?: string;
    role?: string;
    relationshipId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
// The UML model is shared; each diagram owns its visual representations and freehand scene.
export type DiagramKind =
  | 'class'
  | 'use-case'
  | 'sequence'
  | 'activity'
  | 'state'
  | 'component'
  | 'deployment'
  | 'object'
  | 'package'
  | 'data-flow'
  | 'communication';
export type Diagram = {
  id: string;
  name: string;
  kind?: DiagramKind;
  classIds: string[];
  relationshipIds: string[];
  nativeElementIds?: string[];
  nativeRelationshipIds?: string[];
  labId?: string;
  elements: SceneElement[];
  viewport?: {
    scrollX: number;
    scrollY: number;
    zoom: { value: number };
    viewBackgroundColor: string;
  };
};
export type Project = {
  format: 'arxdraw';
  version: 1;
  name: string;
  classes: Classifier[];
  relationships: Relationship[];
  diagrams: Diagram[];
  activeDiagramId: string;
  files: Record<string, unknown>;
  nativeModel?: NativeUmlModel;
};
export const uid = () => crypto.randomUUID();
export function createBlankProject(): Project {
  const id = uid();
  return {
    format: 'arxdraw',
    version: 1,
    name: 'Untitled',
    activeDiagramId: id,
    classes: [],
    relationships: [],
    files: {},
    diagrams: [
      {
        id,
        name: 'Diagram 1',
        classIds: [],
        relationshipIds: [],
        elements: [],
      },
    ],
  };
}

export function removeDiagram(project: Project, id: string): Project {
  const index = project.diagrams.findIndex((d) => d.id === id);
  if (index === -1) return project;
  const diagrams = project.diagrams.filter((d) => d.id !== id);
  if (!diagrams.length) diagrams.push(createBlankProject().diagrams[0]);
  return {
    ...project,
    diagrams,
    activeDiagramId:
      project.activeDiagramId === id
        ? diagrams[Math.min(index, diagrams.length - 1)].id
        : project.activeDiagramId,
  };
}

export function createProject(): Project {
  return {
    format: 'arxdraw',
    version: 1,
    name: 'Commerce architecture',
    activeDiagramId: 'domain',
    files: {},
    classes: [
      {
        id: 'user',
        name: 'User',
        kind: 'class',
        attributes: '- id: UUID\n- name: String\n- email: String',
        operations: '+ signIn(): Boolean\n+ placeOrder(): Order',
        description: 'A customer who can browse products and place orders.',
      },
      {
        id: 'order',
        name: 'Order',
        kind: 'class',
        attributes: '- id: UUID\n- createdAt: DateTime\n- status: OrderStatus',
        operations: '+ calculateTotal(): Money\n+ confirm(): void',
        description:
          'An order belongs to one customer and contains one or more items.',
      },
      {
        id: 'item',
        name: 'OrderItem',
        kind: 'class',
        attributes: '- quantity: Integer\n- unitPrice: Money',
        operations: '+ subtotal(): Money',
        description: 'A line item owned by an order.',
      },
      {
        id: 'payment',
        name: 'PaymentService',
        kind: 'interface',
        attributes: '',
        operations:
          '+ charge(order: Order): Receipt\n+ refund(id: UUID): Boolean',
        description: 'The payment boundary used during checkout.',
      },
    ],
    relationships: [
      {
        id: 'places',
        from: 'user',
        to: 'order',
        kind: 'association',
        label: 'places',
        sourceMultiplicity: '1',
        targetMultiplicity: '0..*',
      },
      {
        id: 'contains',
        from: 'order',
        to: 'item',
        kind: 'composition',
        label: 'contains',
        sourceMultiplicity: '1',
        targetMultiplicity: '1..*',
      },
      {
        id: 'charges',
        from: 'order',
        to: 'payment',
        kind: 'dependency',
        label: 'uses',
        sourceMultiplicity: '',
        targetMultiplicity: '',
      },
    ],
    diagrams: [
      {
        id: 'domain',
        name: 'Domain model',
        classIds: ['user', 'order', 'item'],
        relationshipIds: ['places', 'contains'],
        elements: [],
      },
      {
        id: 'checkout',
        name: 'Checkout',
        classIds: ['user', 'order', 'payment'],
        relationshipIds: ['places', 'charges'],
        elements: [],
      },
    ],
  };
}
export function updateClassifier(
  project: Project,
  id: string,
  patch: Partial<Classifier>,
): Project {
  return {
    ...project,
    classes: project.classes.map((c) =>
      c.id === id ? { ...c, ...patch, id } : c,
    ),
  };
}
export function removeClassifier(project: Project, id: string): Project {
  const removed = new Set(
    project.relationships
      .filter((r) => r.from === id || r.to === id)
      .map((r) => r.id),
  );
  return {
    ...project,
    classes: project.classes.filter((c) => c.id !== id),
    relationships: project.relationships.filter((r) => !removed.has(r.id)),
    diagrams: project.diagrams.map((d) => ({
      ...d,
      classIds: d.classIds.filter((c) => c !== id),
      relationshipIds: d.relationshipIds.filter((r) => !removed.has(r)),
    })),
  };
}
export { parseProject } from './project-parse.ts';
export { projectDiagnostics } from './diagnostics.ts';
export type { ProjectDiagnostic } from './diagnostics.ts';
export { duplicateDiagram, mergeProjects } from './project-operations.ts';
export function projectIssues(project: Project): string[] {
  return projectDiagnostics(project).map((diagnostic) => diagnostic.message);
}
