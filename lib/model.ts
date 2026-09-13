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
  | 'communication';
export type Diagram = {
  id: string;
  name: string;
  kind?: DiagramKind;
  classIds: string[];
  relationshipIds: string[];
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
export function projectIssues(p: Project): string[] {
  const issues: string[] = [];
  const names = new Set<string>();
  for (const c of p.classes) {
    if (!c.name.trim()) issues.push('A classifier needs a name.');
    else if (names.has(c.name.trim()))
      issues.push(`Duplicate classifier name: ${c.name}.`);
    names.add(c.name.trim());
  }
  for (const r of p.relationships)
    if (
      r.kind === 'realization' &&
      p.classes.find((c) => c.id === r.to)?.kind !== 'interface'
    )
      issues.push('A realization should point to an interface.');
  const parents = new Map<string, string[]>();
  for (const r of p.relationships)
    if (r.kind === 'inheritance')
      parents.set(r.from, [...(parents.get(r.from) || []), r.to]);
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((parents.get(id) || []).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  if (p.classes.some((c) => visit(c.id)))
    issues.push('Inheritance contains a cycle.');
  return issues;
}
export function parseProject(raw: string): Project {
  if (raw.length > 40_000_000)
    throw new Error('This project is too large (40 MB maximum).');
  const p = JSON.parse(raw);
  const fail = () => {
    throw new Error('This is not a valid ArxDraw v1 project.');
  };
  if (
    !p ||
    p.format !== 'arxdraw' ||
    p.version !== 1 ||
    typeof p.name !== 'string' ||
    !Array.isArray(p.classes) ||
    !Array.isArray(p.relationships) ||
    !Array.isArray(p.diagrams) ||
    !p.diagrams.length ||
    p.diagrams.length > 100 ||
    p.classes.length > 2000
  )
    fail();
  const str = (v: unknown) => typeof v === 'string';
  const unique = (items: { id: string }[]) =>
    new Set(items.map((x) => x.id)).size === items.length;
  for (const c of p.classes)
    if (
      !c ||
      ![c.id, c.name, c.attributes, c.operations, c.description].every(str) ||
      !['class', 'interface', 'abstract'].includes(c.kind)
    )
      fail();
  if (!unique(p.classes) || !unique(p.relationships) || !unique(p.diagrams))
    fail();
  const classIds = new Set(p.classes.map((c: Classifier) => c.id));
  const relIds = new Set(p.relationships.map((r: Relationship) => r.id));
  for (const r of p.relationships)
    if (
      !r ||
      ![
        r.id,
        r.from,
        r.to,
        r.label,
        r.sourceMultiplicity,
        r.targetMultiplicity,
      ].every(str) ||
      !relationshipKinds.includes(r.kind) ||
      !classIds.has(r.from) ||
      !classIds.has(r.to)
    )
      fail();
  for (const d of p.diagrams) {
    if (
      !d ||
      !str(d.id) ||
      !str(d.name) ||
      (d.kind !== undefined &&
        ![
          'class',
          'use-case',
          'sequence',
          'activity',
          'state',
          'component',
          'deployment',
          'object',
          'package',
          'communication',
        ].includes(d.kind)) ||
      !Array.isArray(d.classIds) ||
      !d.classIds.every((id: string) => classIds.has(id)) ||
      !Array.isArray(d.relationshipIds) ||
      !d.relationshipIds.every((id: string) => relIds.has(id)) ||
      !Array.isArray(d.elements) ||
      d.elements.length > 20000
    )
      fail();
    for (const e of d.elements)
      if (
        !e ||
        !str(e.id) ||
        !str(e.type) ||
        !Number.isFinite(e.x) ||
        !Number.isFinite(e.y) ||
        !Number.isFinite(e.width) ||
        !Number.isFinite(e.height)
      )
        fail();
    if (
      d.viewport &&
      (!Number.isFinite(d.viewport.scrollX) ||
        !Number.isFinite(d.viewport.scrollY) ||
        !Number.isFinite(d.viewport.zoom?.value) ||
        d.viewport.zoom.value <= 0 ||
        d.viewport.zoom.value > 30 ||
        !str(d.viewport.viewBackgroundColor))
    )
      fail();
  }
  if (
    !p.diagrams.some((d: Diagram) => d.id === p.activeDiagramId) ||
    !p.files ||
    typeof p.files !== 'object' ||
    Array.isArray(p.files)
  )
    fail();
  return p as Project;
}
