import type { Diagram, Project } from './model.ts';

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
  };
  start?: { id: string };
  end?: { id: string };
  startArrowhead?: string | null;
  [key: string]: unknown;
};
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
    const height = 62 + ah + oh;
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
  d.relationshipIds.forEach((id) => {
    const r = p.relationships.find((r) => r.id === id);
    if (!r) return;
    const a = positions.get(r.from),
      b = positions.get(r.to);
    if (!a || !b) return;
    const forward = b.x >= a.x;
    const sx = forward ? a.x + a.width : a.x,
      ex = forward ? b.x : b.x + b.width;
    const sy = a.y + a.height / 2,
      ey = b.y + b.height / 2;
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
    const label = [r.sourceMultiplicity, r.label, r.targetMultiplicity]
      .filter(Boolean)
      .join('  ·  ');
    raw.push({
      id: `rel-${d.id}-${id}`,
      type: 'arrow',
      x: sx + 8 * (forward ? 1 : -1),
      y: sy,
      points: [
        [0, 0],
        [ex - sx - 16 * (forward ? 1 : -1), ey - sy],
      ],
      strokeColor: '#696575',
      strokeWidth: 1.5,
      roughness: 0,
      roundness: null,
      strokeStyle: ['dependency', 'realization'].includes(r.kind)
        ? 'dashed'
        : 'solid',
      startArrowhead,
      endArrowhead,
      start: { id: source },
      end: { id: target },
      label: label ? { text: label, fontSize: 14, fontFamily: 2 } : undefined,
      customData: { relationshipId: id, arxdraw: true },
    });
  });
  return raw;
}
