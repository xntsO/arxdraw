import type {
  Classifier,
  Diagram,
  DiagramKind,
  Project,
  Relationship,
} from './model.ts';
import { createBlankProject, uid } from './model.ts';
import { connectorSkeleton, symbolSkeletons } from './practice.ts';
import type { PracticeSkeleton } from './practice.ts';
import { isNativeUmlMetadata } from './native-model-types.ts';
import type {
  NativeElementKind,
  NativeRelationshipKind,
} from './native-model-types.ts';

export type CourseBlueprint = {
  project: Project;
  scenes: { diagramId: string; skeletons: PracticeSkeleton[] }[];
};
export type CourseNode = {
  key: string;
  tool: NativeElementKind;
  name: string;
  x: number;
  y: number;
  slots?: string;
};
export type CourseEdge = {
  from: string;
  to: string;
  kind: NativeRelationshipKind;
  name: string;
};
export const n = (
  key: string,
  tool: NativeElementKind,
  name: string,
  x: number,
  y: number,
  slots?: string,
): CourseNode => ({ key, tool, name, x, y, slots });
export const e = (
  from: string,
  to: string,
  kind: NativeRelationshipKind,
  name = '',
): CourseEdge => ({ from, to, kind, name });

type GraphPoint = [number, number];
type GraphBox = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
type GraphSide = 'top' | 'right' | 'bottom' | 'left';
const graphSides: GraphSide[] = ['top', 'right', 'bottom', 'left'];

/** Open rectangle intersection, so touching a routed margin is permitted. */
function crossesGraphBox(
  a: GraphPoint,
  b: GraphPoint,
  box: GraphBox,
  padding = 0,
): boolean {
  let enter = 0,
    leave = 1;
  for (const [origin, delta, low, high] of [
    [a[0], b[0] - a[0], box.x - padding, box.x + box.width + padding],
    [a[1], b[1] - a[1], box.y - padding, box.y + box.height + padding],
  ]) {
    if (Math.abs(delta) < 0.001) {
      if (origin <= low || origin >= high) return false;
    } else {
      const first = (low - origin) / delta,
        second = (high - origin) / delta;
      enter = Math.max(enter, Math.min(first, second));
      leave = Math.min(leave, Math.max(first, second));
      if (enter >= leave) return false;
    }
  }
  return enter < leave && leave > 0 && enter < 1;
}
function graphPort(
  box: GraphBox,
  side: GraphSide,
  offset: number,
): { anchor: GraphPoint; stub: GraphPoint } {
  const horizontal = side === 'left' || side === 'right';
  const shift = Math.max(
    -(horizontal ? box.height : box.width) * 0.3,
    Math.min((horizontal ? box.height : box.width) * 0.3, offset),
  );
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  switch (side) {
    case 'top':
      return {
        anchor: [cx + shift, box.y - 5],
        stub: [cx + shift, box.y - 29],
      };
    case 'right':
      return {
        anchor: [box.x + box.width + 5, cy + shift],
        stub: [box.x + box.width + 29, cy + shift],
      };
    case 'bottom':
      return {
        anchor: [cx + shift, box.y + box.height + 5],
        stub: [cx + shift, box.y + box.height + 29],
      };
    case 'left':
      return {
        anchor: [box.x - 5, cy + shift],
        stub: [box.x - 29, cy + shift],
      };
  }
}
function simplifyGraphRoute(points: GraphPoint[]): GraphPoint[] {
  const result: GraphPoint[] = [];
  for (const point of points) {
    const last = result.at(-1);
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    const before = result.at(-2);
    // Remove only points between their neighbours, never an outward turnback.
    if (
      before &&
      last &&
      ((before[0] === last[0] &&
        last[0] === point[0] &&
        (last[1] - before[1]) * (point[1] - last[1]) >= 0) ||
        (before[1] === last[1] &&
          last[1] === point[1] &&
          (last[0] - before[0]) * (point[0] - last[0]) >= 0))
    )
      result.pop();
    result.push(point);
  }
  return result;
}
function graphRoutesOverlap(a: GraphPoint[], b: GraphPoint[]): boolean {
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) {
      const p = a[i - 1],
        q = a[i],
        r = b[j - 1],
        s = b[j];
      if (
        p[0] === q[0] &&
        r[0] === s[0] &&
        Math.abs(p[0] - r[0]) < 1 &&
        Math.min(Math.max(p[1], q[1]), Math.max(r[1], s[1])) -
          Math.max(Math.min(p[1], q[1]), Math.min(r[1], s[1])) >
          4
      )
        return true;
      if (
        p[1] === q[1] &&
        r[1] === s[1] &&
        Math.abs(p[1] - r[1]) < 1 &&
        Math.min(Math.max(p[0], q[0]), Math.max(r[0], s[0])) -
          Math.max(Math.min(p[0], q[0]), Math.min(r[0], s[0])) >
          4
      )
        return true;
    }
  return false;
}
function graphLabelCenter(points: GraphPoint[]): GraphPoint {
  const middle = Math.floor(points.length / 2);
  if (points.length % 2) return points[middle];
  return [
    (points[middle - 1][0] + points[middle][0]) / 2,
    (points[middle - 1][1] + points[middle][1]) / 2,
  ];
}
function orthogonalGraphRoute(
  source: GraphBox,
  target: GraphBox,
  boxes: GraphBox[],
  offset: number,
  previous: GraphPoint[][],
  labelWidth: number,
): GraphPoint[] | undefined {
  const margin = 30 + Math.abs(offset) + Math.max(0, labelWidth - 100);
  let best: GraphPoint[] | undefined,
    bestScore = Infinity;
  for (const sourceSide of graphSides)
    for (const targetSide of graphSides) {
      const start = graphPort(source, sourceSide, offset),
        end = graphPort(target, targetSide, offset);
      const xs = new Set([
        (start.stub[0] + end.stub[0]) / 2 + offset,
        ...boxes.flatMap((box) => [box.x - margin, box.x + box.width + margin]),
      ]);
      const ys = new Set([
        (start.stub[1] + end.stub[1]) / 2 + offset,
        ...boxes.flatMap((box) => [
          box.y - margin,
          box.y + box.height + margin,
        ]),
      ]);
      const middle: GraphPoint[][] = [
        [start.stub, [start.stub[0], end.stub[1]], end.stub],
        [start.stub, [end.stub[0], start.stub[1]], end.stub],
        ...[...xs].map((x): GraphPoint[] => [
          start.stub,
          [x, start.stub[1]],
          [x, end.stub[1]],
          end.stub,
        ]),
        ...[...ys].map((y): GraphPoint[] => [
          start.stub,
          [start.stub[0], y],
          [end.stub[0], y],
          end.stub,
        ]),
      ];
      for (const inner of middle) {
        const candidate = simplifyGraphRoute([
          start.anchor,
          ...inner,
          end.anchor,
        ]);
        if (
          candidate
            .slice(1)
            .some((point, index) =>
              boxes.some((box) =>
                crossesGraphBox(
                  candidate[index],
                  point,
                  box,
                  box.key === source.key || box.key === target.key ? 0 : 12,
                ),
              ),
            )
        )
          continue;
        const length = candidate
          .slice(1)
          .reduce(
            (sum, point, index) =>
              sum +
              Math.abs(point[0] - candidate[index][0]) +
              Math.abs(point[1] - candidate[index][1]),
            0,
          );
        // Prefer independent sibling lanes, then the shortest collision-free path.
        const labelCenter = graphLabelCenter(candidate);
        const labelCollision = previous.some((route) => {
          const center = graphLabelCenter(route);
          return (
            Math.abs(center[0] - labelCenter[0]) < labelWidth + 12 &&
            Math.abs(center[1] - labelCenter[1]) < 26
          );
        });
        const score =
          length +
          candidate.length * 0.01 +
          (previous.some((route) => graphRoutesOverlap(candidate, route))
            ? 1_000_000
            : 0) +
          (labelCollision ? 1_000_000 : 0);
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }
  return best;
}

export function graph(
  nodes: CourseNode[],
  edges: CourseEdge[],
): PracticeSkeleton[] {
  const result: PracticeSkeleton[] = [];
  const boxes = new Map<string, PracticeSkeleton>();
  for (const node of nodes) {
    const parts = symbolSkeletons(node.tool, node.x, node.y, node.name, {
      slots: node.slots,
    });
    const box = parts[0];
    if (!box) throw new Error(`Missing symbol for ${node.key}.`);
    boxes.set(node.key, box);
    result.push(...parts);
  }
  const bounds: GraphBox[] = [...boxes].map(([key, box]) => ({
    key,
    x: box.x,
    y: box.y,
    width: box.width ?? 0,
    height: box.height ?? 0,
  }));
  const pairKey = (edge: CourseEdge) =>
    JSON.stringify([edge.from, edge.to].sort());
  const siblings = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    const key = pairKey(edge);
    siblings.set(key, [...(siblings.get(key) ?? []), index]);
  });
  const routed = new Map<string, GraphPoint[][]>();
  for (const [index, edge] of edges.entries()) {
    const a = boxes.get(edge.from),
      b = boxes.get(edge.to);
    if (!a || !b)
      throw new Error(
        `Unknown endpoint in course example: ${edge.from} → ${edge.to}.`,
      );
    const ax = a.x + (a.width ?? 0) / 2,
      ay = a.y + (a.height ?? 0) / 2;
    const bx = b.x + (b.width ?? 0) / 2,
      by = b.y + (b.height ?? 0) / 2;
    const vertical = Math.abs(by - ay) > Math.abs(bx - ax);
    const sign = (vertical ? by - ay : bx - ax) >= 0 ? 1 : -1;
    const sx = ax + (vertical ? 0 : sign * ((a.width ?? 0) / 2 + 5));
    const sy = ay + (vertical ? sign * ((a.height ?? 0) / 2 + 5) : 0);
    const tx = bx - (vertical ? 0 : sign * ((b.width ?? 0) / 2 + 5));
    const ty = by - (vertical ? sign * ((b.height ?? 0) / 2 + 5) : 0);
    const arrow = connectorSkeleton(
      edge.kind,
      sx,
      sy,
      tx,
      ty,
      edge.name,
      a.id,
      b.id,
    );
    const direct: GraphPoint[] = [
      [sx, sy],
      [tx, ty],
    ];
    const pair = pairKey(edge),
      family = siblings.get(pair) ?? [index];
    const blocked = bounds.some(
      (box) =>
        box.key !== edge.from &&
        box.key !== edge.to &&
        crossesGraphBox(direct[0], direct[1], box, 12),
    );
    let route: GraphPoint[] | undefined;
    if (edge.from === edge.to) {
      const right = a.x + (a.width ?? 0) + 5,
        reach = right + 80;
      route = [
        [right, ay - 20],
        [reach, ay - 20],
        [reach, ay + 20],
        [right, ay + 20],
      ];
    } else if (blocked || family.length > 1) {
      const source = bounds.find((box) => box.key === edge.from),
        target = bounds.find((box) => box.key === edge.to);
      if (source && target)
        route = orthogonalGraphRoute(
          source,
          target,
          bounds,
          (family.indexOf(index) - (family.length - 1) / 2) * 18,
          routed.get(pair) ?? [],
          Math.max(
            0,
            ...family.map(
              (edgeIndex) =>
                Math.max(
                  ...edges[edgeIndex].name
                    .split('\n')
                    .map((line) => line.length),
                ) *
                  7.5 +
                16,
            ),
          ),
        );
    }
    if (route) {
      const first = route[0];
      arrow.x = first[0];
      arrow.y = first[1];
      arrow.points = route.map(([x, y]) => [x - first[0], y - first[1]]);
      arrow.width =
        Math.max(...route.map(([x]) => x)) - Math.min(...route.map(([x]) => x));
      arrow.height =
        Math.max(...route.map(([, y]) => y)) -
        Math.min(...route.map(([, y]) => y));
      routed.set(pair, [...(routed.get(pair) ?? []), route]);
    }
    result.push(arrow);
  }
  return result;
}

export function buildUseCaseDiagram(
  system: string,
  actors: string[],
  goals: string[],
  assignments: [number, number][],
  extra: CourseEdge[] = [],
): PracticeSkeleton[] {
  const height = Math.ceil(goals.length / 2) * 150 + 95;
  const boundary = symbolSkeletons('system', 300, 40, system);
  if (boundary[0]) {
    boundary[0].width = 650;
    boundary[0].height = height;
  }
  const nodes = [
    ...actors.map((name, i) =>
      n(
        `a${i}`,
        'actor',
        name,
        i % 2 ? 1050 : 80,
        140 + Math.floor(i / 2) * 230,
      ),
    ),
    ...goals.map((name, i) =>
      n(
        `g${i}`,
        'use-case',
        name,
        350 + (i % 2) * 310,
        120 + Math.floor(i / 2) * 150,
      ),
    ),
  ];
  return [
    ...boundary,
    ...graph(nodes, [
      ...assignments.map(([actor, goal]) =>
        e(`a${actor}`, `g${goal}`, 'association'),
      ),
      ...extra,
    ]),
  ];
}

export type SequenceMessage = {
  from: number;
  to: number;
  text: string;
  reply?: boolean;
};
export function sequence(
  participants: string[],
  messages: SequenceMessage[],
): PracticeSkeleton[] {
  const result: PracticeSkeleton[] = [];
  const height = messages.length * 80 + 100;
  const anchors = participants.map((name, i) => {
    const x = 100 + i * 330;
    const parts = symbolSkeletons('participant', x, 60, name, {
      lifelineHeight: height + 60,
    });
    const activation = symbolSkeletons('activation', x + 76, 155)[0];
    const metadata = parts[0]?.customData;
    if (
      !activation ||
      !metadata ||
      typeof metadata !== 'object' ||
      !('uml' in metadata) ||
      !isNativeUmlMetadata(metadata.uml)
    )
      throw new Error('Invalid sequence participant template.');
    // An activation is a visual part of this participant, so messages retain
    // participant identity while their arrow endpoints follow the lifeline.
    activation.customData = { uml: { ...metadata.uml, role: 'decor' } };
    activation.height = height;
    result.push(...parts, activation);
    return activation;
  });
  messages.forEach((message, i) => {
    const source = anchors[message.from],
      target = anchors[message.to];
    if (!source || !target)
      throw new Error('Invalid sequence participant index.');
    const y = 190 + i * 80;
    const forward = target.x >= source.x;
    result.push(
      connectorSkeleton(
        message.from === message.to
          ? 'self-message'
          : message.reply
            ? 'return'
            : 'message',
        source.x + (forward ? 23 : -5),
        y,
        target.x + (forward ? -5 : 23),
        y,
        `${i + 1}: ${message.text}`,
        source.id,
        target.id,
      ),
    );
  });
  return result;
}
export const msg = (
  from: number,
  to: number,
  text: string,
  reply = false,
): SequenceMessage => ({ from, to, text, reply });

export type CourseClass = {
  key: string;
  name: string;
  x: number;
  y: number;
  attributes?: string;
  operations?: string;
  kind?: Classifier['kind'];
  description?: string;
};
export type CourseClassLink = {
  from: string;
  to: string;
  kind: Relationship['kind'];
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
};
export const c = (
  key: string,
  name: string,
  x: number,
  y: number,
  attributes = '',
  operations = '',
): CourseClass => ({ key, name, x, y, attributes, operations });
export const r = (
  from: string,
  to: string,
  kind: Relationship['kind'],
  label = '',
  sourceMultiplicity = '',
  targetMultiplicity = '',
): CourseClassLink => ({
  from,
  to,
  kind,
  label,
  sourceMultiplicity,
  targetMultiplicity,
});

export function classBlueprint(
  title: string,
  classes: CourseClass[],
  links: CourseClassLink[],
  blank: boolean,
): CourseBlueprint {
  const project = createBlankProject();
  project.name = title;
  const diagram = project.diagrams[0];
  diagram.name = title;
  diagram.kind = 'class';
  if (blank) return { project, scenes: [] };
  const ids = new Map(classes.map((item) => [item.key, uid()]));
  const idFor = (key: string) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Unknown course classifier ${key}.`);
    return id;
  };
  project.classes = classes.map((item) => ({
    id: idFor(item.key),
    name: item.name,
    kind: item.kind ?? 'class',
    attributes: item.attributes ?? '',
    operations: item.operations ?? '',
    description: item.description ?? '',
  }));
  project.relationships = links.map((link) => ({
    id: uid(),
    from: idFor(link.from),
    to: idFor(link.to),
    kind: link.kind,
    label: link.label ?? '',
    sourceMultiplicity: link.sourceMultiplicity ?? '',
    targetMultiplicity: link.targetMultiplicity ?? '',
  }));
  diagram.classIds = project.classes.map((item) => item.id);
  diagram.relationshipIds = project.relationships.map((item) => item.id);
  diagram.elements = classes.map((item) => ({
    id: `uml-${diagram.id}-${idFor(item.key)}-box`,
    type: 'rectangle',
    x: item.x,
    y: item.y,
    width: 260,
    height: 180,
    customData: { arxdraw: true, role: 'box', modelId: idFor(item.key) },
  }));
  return { project, scenes: [] };
}

export function nativeBlueprint(
  title: string,
  kind: DiagramKind,
  diagrams: { name: string; elements: PracticeSkeleton[] }[],
  blank: boolean,
): CourseBlueprint {
  const project = createBlankProject();
  project.name = title;
  const scenes: CourseBlueprint['scenes'] = [];
  const shared = new Map<string, string>();
  project.diagrams = diagrams.map((item): Diagram => {
    const id = uid();
    const replacements = new Map<string, string>();
    for (const element of item.elements) {
      const data = element.customData;
      if (
        !data ||
        typeof data !== 'object' ||
        !('uml' in data) ||
        !isNativeUmlMetadata(data.uml) ||
        data.uml.role !== 'node'
      )
        continue;
      const key = `${data.uml.kind}\0${data.uml.name ?? ''}`;
      const previous = shared.get(key);
      if (previous) replacements.set(data.uml.id, previous);
      else shared.set(key, data.uml.id);
    }
    const skeletons = item.elements.map((element) => {
      const data = element.customData;
      if (
        !data ||
        typeof data !== 'object' ||
        !('uml' in data) ||
        !isNativeUmlMetadata(data.uml)
      )
        return element;
      const replacement = replacements.get(data.uml.id);
      return replacement
        ? {
            ...element,
            customData: { ...data, uml: { ...data.uml, id: replacement } },
          }
        : element;
    });
    scenes.push({ diagramId: id, skeletons: blank ? [] : skeletons });
    return {
      id,
      name: item.name,
      kind,
      classIds: [],
      relationshipIds: [],
      elements: [],
    };
  });
  project.activeDiagramId = project.diagrams[0]?.id ?? project.activeDiagramId;
  return { project, scenes };
}
