import type { Graph } from '../graph/Graph';

export interface RingNode {
  label: string;
  x: number;
  y: number;
  size: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConstellationLayout {
  centre: { x: number; y: number };
  ringRadius: number;
  ring: RingNode[];
  outer: RingNode[];
  links: Segment[];
}

export function constellationLayout(graph: Graph, size: { width: number; height: number }, outerCount = 12): ConstellationLayout {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const ringRadius = Math.min(size.width, size.height) * 0.3;
  const outerRadius = ringRadius * 1.55;
  const roots = graph.children(-1);
  const ring: RingNode[] = roots.map((i, k) => {
    const angle = (k / roots.length) * Math.PI * 2 - Math.PI / 2;
    return { label: graph.ids[i], x: cx + Math.cos(angle) * ringRadius, y: cy + Math.sin(angle) * ringRadius, size: graph.descendantCount(i) };
  });
  const angleOf = new Map(ring.map((n, k) => [n.label, (k / roots.length) * Math.PI * 2 - Math.PI / 2]));

  const seconds = roots.flatMap((i) => graph.children(i)).map((i) => ({ i, size: graph.descendantCount(i) }));
  seconds.sort((a, b) => b.size - a.size || (graph.ids[a.i] < graph.ids[b.i] ? -1 : 1));
  const perParent = new Map<string, number>();
  const outer: RingNode[] = seconds.slice(0, outerCount).map(({ i, size: s }) => {
    const id = graph.ids[i];
    const parent = id.slice(0, id.indexOf('/'));
    const n = perParent.get(parent) ?? 0;
    perParent.set(parent, n + 1);
    const angle = (angleOf.get(parent) ?? 0) + (n - 0.5) * 0.12;
    return { label: id, x: cx + Math.cos(angle) * outerRadius, y: cy + Math.sin(angle) * outerRadius, size: s };
  });

  const links: Segment[] = [
    ...ring.map((n) => ({ x1: cx, y1: cy, x2: n.x, y2: n.y })),
    ...outer.map((n) => {
      const p = ring.find((r) => r.label === n.label.slice(0, n.label.indexOf('/')))!;
      return { x1: p.x, y1: p.y, x2: n.x, y2: n.y };
    }),
  ];
  return { centre: { x: cx, y: cy }, ringRadius, ring, outer, links };
}
