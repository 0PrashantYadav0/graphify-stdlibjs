import { hierarchy, tree } from 'd3-hierarchy';
import { linkHorizontal } from 'd3-shape';

export const NODE_W = 260;
export const NODE_H = 40;
export const LEVEL_DX = 320;
export const ROW_DY = 52;

export type Direction = 'right' | 'left';

export interface LayoutNode<T> {
  data: T;
  x: number;
  y: number;
  depth: number;
  parentKey: string | null;
}

export interface LayoutLink {
  source: string;
  target: string;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}

export interface LayoutResult<T> {
  nodes: LayoutNode<T>[];
  links: LayoutLink[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const curve = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
  .x((p) => p[0])
  .y((p) => p[1]);

export function linkPath(link: LayoutLink): string {
  return curve({ source: [link.sx, link.sy], target: [link.tx, link.ty] }) ?? '';
}

export function layoutTree<T extends { key: string }>(
  root: T,
  childrenOf: (n: T) => T[],
  isExpanded: (n: T) => boolean,
  direction: Direction = 'right',
): LayoutResult<T> {
  const h = hierarchy(root, (n) => (isExpanded(n) ? childrenOf(n) : []));
  const laid = tree<T>().nodeSize([ROW_DY, LEVEL_DX])(h);
  const sign = direction === 'right' ? 1 : -1;
  const half = NODE_W / 2;
  const nodes: LayoutNode<T>[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  laid.each((n) => {
    const x = sign * n.y;
    const y = n.x;
    nodes.push({ data: n.data, x, y, depth: n.depth, parentKey: n.parent ? n.parent.data.key : null });
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  const links: LayoutLink[] = laid.links().map((l) => ({
    source: l.source.data.key,
    target: l.target.data.key,
    sx: sign * l.source.y + sign * half,
    sy: l.source.x,
    tx: sign * l.target.y - sign * half,
    ty: l.target.x,
  }));
  return { nodes, links, minX, maxX, minY, maxY };
}
