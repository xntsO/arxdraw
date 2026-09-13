import type { Diagram, Project, SceneElement } from './model.ts';

export type UmlSkeleton = {
  id: string;
  type: 'rectangle' | 'line' | 'text' | 'arrow';
  x: number;
  y: number;
  text?: string;
  customData: {
    modelId?: string;
    role?: string;
    relationshipId?: string;
    arxdraw: boolean;
    [key: string]: unknown;
  };
  start?: { id: string };
  end?: { id: string };
  startArrowhead?: string | null;
  [key: string]: unknown;
};
type Point = [number, number];
type Box = { x: number; y: number; width: number; height: number };

// Only visual properties survive regeneration; model identity and UML arrowheads do not.
function visualStyle(element?: SceneElement): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  for (const key of [
    'strokeColor',
    'backgroundColor',
    'strokeWidth',
    'strokeStyle',
    'roughness',
    'opacity',
    'fillStyle',
  ]) {
    if (element?.[key] !== undefined) style[key] = element[key];
  }
  return style;
}
function points(value: unknown): Point[] | undefined {
  return Array.isArray(value) &&
    value.length >= 2 &&
    value.every(
      (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
    )
    ? (value as Point[])
    : undefined;
}
function changedRoute(old: SceneElement): boolean {
  const current = points(old.points),
    generated = points(old.customData?.routePoints);
  if (!current) return false;
  if (old.customData?.manualRoute === true) return true;
  if (!generated) return current.length > 2;
  // Excalidraw adjusts bound endpoints by half a pixel during conversion.
  return (
    current.length !== generated.length ||
    current.some(
      (p, i) =>
        Math.abs(p[0] - generated[i][0]) > 2 ||
        Math.abs(p[1] - generated[i][1]) > 2,
    )
  );
}
function resizeAnchor(
  point: Point,
  before: SceneElement | undefined,
  after: Box,
): Point {
  if (!before) return point;
  const coordinate = (
    value: number,
    origin: number,
    size: number,
    newOrigin: number,
    newSize: number,
  ) =>
    value < origin
      ? value + newOrigin - origin
      : value > origin + size
        ? value + newOrigin + newSize - origin - size
        : newOrigin + ((value - origin) * newSize) / (size || 1);
  return [
    coordinate(point[0], before.x, before.width, after.x, after.width),
    coordinate(point[1], before.y, before.height, after.y, after.height),
  ];
}
function endpointLabel(point: Point, neighbour: Point, value: string): Point {
  const dx = neighbour[0] - point[0],
    dy = neighbour[1] - point[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length,
    uy = dy / length;
  // Sit outside the class, beside the first/last segment, clear of arrowheads.
  return [
    point[0] + ux * 28 - uy * 16 - value.length * 3.5,
    point[1] + uy * 28 + ux * 16 - 8,
  ];
}
function defaultRoute(
  a: Box,
  b: Box,
  lane: number,
  selfIndex: number,
  self: boolean,
): Point[] {
  if (self) {
    const reach = 64 + selfIndex * 34;
    const sx = a.x + a.width + 8,
      sy = a.y + a.height * 0.3;
    const ex = a.x + a.width * 0.65,
      ey = a.y - 8;
    return [
      [sx, sy],
      [sx + reach, sy],
      [sx + reach, ey - reach],
      [ex, ey - reach],
      [ex, ey],
    ];
  }
  const acx = a.x + a.width / 2,
    acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2,
    bcy = b.y + b.height / 2;
  const horizontal =
    Math.abs(bcx - acx) / ((a.width + b.width) / 2) >=
    Math.abs(bcy - acy) / ((a.height + b.height) / 2);
  if (horizontal) {
    const dir = bcx >= acx ? 1 : -1;
    const sy =
      acy + Math.max(-a.height * 0.32, Math.min(a.height * 0.32, lane));
    const ey =
      bcy + Math.max(-b.height * 0.32, Math.min(b.height * 0.32, lane));
    const sx = acx + dir * (a.width / 2 + 8),
      ex = bcx - dir * (b.width / 2 + 8);
    if (!lane)
      return [
        [sx, sy],
        [ex, ey],
      ];
    return [
      [sx, sy],
      [(sx + ex) / 2, (sy + ey) / 2 + lane],
      [ex, ey],
    ];
  }
  const dir = bcy >= acy ? 1 : -1;
  const sx = acx + Math.max(-a.width * 0.32, Math.min(a.width * 0.32, lane));
  const ex = bcx + Math.max(-b.width * 0.32, Math.min(b.width * 0.32, lane));
  const sy = acy + dir * (a.height / 2 + 8),
    ey = bcy - dir * (b.height / 2 + 8);
  if (!lane)
    return [
      [sx, sy],
      [ex, ey],
    ];
  return [
    [sx, sy],
    [(sx + ex) / 2 + lane, (sy + ey) / 2],
    [ex, ey],
  ];
}

export function diagramSkeletons(p: Project, d: Diagram): UmlSkeleton[] {
  const raw: UmlSkeleton[] = [];
  const positions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  d.classIds.forEach((id, index) => {
    const c = p.classes.find((c) => c.id === id);
    if (!c) return;
    const old = d.elements.find(
      (e) =>
        e.customData?.modelId === id &&
        e.customData?.role === 'box' &&
        !e.isDeleted,
    );
    const lines = [
      ...c.attributes.split('\n'),
      ...c.operations.split('\n'),
      c.name,
    ];
    const width = Math.max(
      250,
      Math.min(520, Math.max(...lines.map((l) => l.length)) * 9 + 32),
      old?.width || 0,
    );
    const ah = Math.max(46, c.attributes.split('\n').length * 23 + 22);
    const oh = Math.max(46, c.operations.split('\n').length * 23 + 22);
    const height = Math.max(62 + ah + oh, old?.height || 0);
    const x = old?.x ?? 80 + (index % 3) * 390;
    const y =
      old?.y ?? 100 + Math.floor(index / 3) * 360 + (index % 3 === 1 ? 80 : 0);
    positions.set(id, { x, y, width, height });
    const groupId = `uml-${d.id}-${id}`;
    const common = {
      strokeColor: old?.strokeColor || '#343440',
      strokeWidth: 1.5,
      roughness: 0,
      roundness: null,
      groupIds: [groupId],
      angle: 0,
      ...visualStyle(old),
    };
    const meta = (role: string) => ({ modelId: id, role, arxdraw: true });
    const add = (
      role: string,
      e: Record<string, unknown> & {
        type: UmlSkeleton['type'];
        x: number;
        y: number;
      },
    ) =>
      raw.push({
        ...common,
        ...e,
        ...visualStyle(
          d.elements.find(
            (part) =>
              !part.isDeleted &&
              part.customData?.modelId === id &&
              part.customData?.role === role,
          ),
        ),
        id: `${groupId}-${role}`,
        customData: meta(role),
      });
    add('box', {
      type: 'rectangle',
      x,
      y,
      width,
      height,
      backgroundColor:
        old?.backgroundColor ||
        (c.kind === 'interface' ? '#f3f0ff' : '#ffffff'),
      fillStyle: 'solid',
    });
    const text = (
      role: string,
      value: string,
      ty: number,
      opts: Record<string, unknown> = {},
    ) =>
      add(role, {
        type: 'text',
        x: x + 16,
        y: ty,
        text: value || ' ',
        fontSize: 16,
        fontFamily: 3,
        strokeWidth: 1,
        ...opts,
      });
    text('kind', c.kind === 'class' ? '«class»' : `«${c.kind}»`, y + 9, {
      fontSize: 12,
      strokeColor: '#787787',
    });
    text('name', c.name, y + 30, { fontSize: 19 });
    add('line1', {
      type: 'line',
      x,
      y: y + 62,
      points: [
        [0, 0],
        [width, 0],
      ],
    });
    text('attributes', c.attributes, y + 74);
    add('line2', {
      type: 'line',
      x,
      y: y + 62 + ah,
      points: [
        [0, 0],
        [width, 0],
      ],
    });
    text('operations', c.operations, y + 74 + ah);
  });
  const visibleRelationships = d.relationshipIds
    .map((id) => p.relationships.find((r) => r.id === id))
    .filter((r) => r && positions.has(r.from) && positions.has(r.to));
  d.relationshipIds.forEach((id) => {
    const r = p.relationships.find((r) => r.id === id);
    if (!r) return;
    const a = positions.get(r.from),
      b = positions.get(r.to);
    if (!a || !b) return;
    const siblings = visibleRelationships.filter(
      (other) =>
        other &&
        ((other.from === r.from && other.to === r.to) ||
          (other.from === r.to && other.to === r.from)),
    );
    const siblingIndex = siblings.findIndex((other) => other?.id === id);
    const lane = (siblingIndex - (siblings.length - 1) / 2) * 34;
    const old = d.elements.find(
      (e) =>
        e.type === 'arrow' &&
        !e.isDeleted &&
        e.customData?.relationshipId === id,
    );
    const sameEndpoints =
      !old?.customData?.from ||
      (old.customData.from === r.from && old.customData.to === r.to);
    const manualRoute = !!old && sameEndpoints && changedRoute(old);
    let route = defaultRoute(a, b, lane, siblingIndex, r.from === r.to);
    const previousPoints = old && points(old.points);
    if (manualRoute && old && previousPoints) {
      route = previousPoints.map(([px, py]) => [old.x + px, old.y + py]);
      // A longer class name or member list can grow the box during this redraw.
      // Keep user bends, while moving just the anchors to the resized boundaries.
      const beforeBox = (modelId: string) =>
        d.elements.find(
          (e) =>
            !e.isDeleted &&
            e.customData?.modelId === modelId &&
            e.customData.role === 'box',
        );
      route[0] = resizeAnchor(route[0], beforeBox(r.from), a);
      route[route.length - 1] = resizeAnchor(route.at(-1)!, beforeBox(r.to), b);
    }
    const [sx, sy] = route[0];
    const relativePoints = route.map(([px, py]) => [px - sx, py - sy]);
    const source = `uml-${d.id}-${r.from}-box`,
      target = `uml-${d.id}-${r.to}-box`;
    const startArrowhead =
      r.kind === 'composition'
        ? 'diamond'
        : r.kind === 'aggregation'
          ? 'diamond_outline'
          : null;
    const endArrowhead =
      r.kind === 'inheritance' || r.kind === 'realization'
        ? 'triangle_outline'
        : r.kind === 'dependency'
          ? 'arrow'
          : null;
    raw.push({
      id: `rel-${d.id}-${id}`,
      type: 'arrow',
      x: sx,
      y: sy,
      points: relativePoints,
      strokeColor: '#696575',
      strokeWidth: 1.5,
      roughness: 0,
      roundness: null,
      strokeStyle: ['dependency', 'realization'].includes(r.kind)
        ? 'dashed'
        : 'solid',
      ...visualStyle(old),
      // Changing semantic kind must update the notation even on a styled arrow.
      ...(old?.customData?.kind && old.customData.kind !== r.kind
        ? {
            strokeStyle: ['dependency', 'realization'].includes(r.kind)
              ? 'dashed'
              : 'solid',
          }
        : {}),
      startArrowhead,
      endArrowhead,
      start: { id: source },
      end: { id: target },
      label: r.label
        ? { text: r.label, fontSize: 14, fontFamily: 2 }
        : undefined,
      customData: {
        relationshipId: id,
        arxdraw: true,
        from: r.from,
        to: r.to,
        kind: r.kind,
        routePoints: relativePoints,
        manualRoute,
      },
    });
    for (const [role, value, point, neighbour] of [
      ['sourceMultiplicity', r.sourceMultiplicity, route[0], route[1]],
      [
        'targetMultiplicity',
        r.targetMultiplicity,
        route.at(-1)!,
        route.at(-2)!,
      ],
    ] as const) {
      if (!value) continue;
      const [x, y] = endpointLabel(point, neighbour, value);
      raw.push({
        id: `rel-${d.id}-${id}-${role}`,
        type: 'text',
        x,
        y,
        text: value,
        fontSize: 14,
        fontFamily: 2,
        strokeColor: old?.strokeColor || '#696575',
        customData: { relationshipId: id, role, arxdraw: true },
      });
    }
  });
  return raw;
}
