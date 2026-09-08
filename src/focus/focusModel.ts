import type { Graph } from '../graph/Graph';
import { buildPathTree, type PathNode } from '../graph/pathTree';
import type { GraphNodeLike } from '../graphview/TreeLayer';

export type Side = 'requires' | 'requiredBy';

export interface FocusNode extends GraphNodeLike {
  path: string;
  children: FocusNode[];
}

const COLLAPSE_ABOVE = 40;
const COLLAPSE_DEEP_ABOVE = 200;

function wrap(side: Side, n: PathNode): FocusNode {
  const children = n.children.map((c) => wrap(side, c));
  return {
    key: `${side}:${n.path}`,
    label: n.label,
    path: n.path,
    index: n.index,
    kind: children.length > 0 ? 'folder' : 'leaf',
    hasChildren: children.length > 0,
    count: children.length > 0 ? n.leafCount : 0,
    children,
  };
}

export function buildSide(graph: Graph, side: Side, indexes: number[]): { root: FocusNode; defaultExpanded: Set<string> } {
  const tree = buildPathTree(indexes.map((i) => graph.ids[i]), (id) => graph.indexOf(id));
  const root = wrap(side, tree);
  const defaultExpanded = new Set<string>();
  // <= COLLAPSE_ABOVE: everything starts expanded. Above it, only the root and its
  // own direct ("depth-0") children start expanded -- everything deeper waits for a
  // click. Above COLLAPSE_DEEP_ABOVE the side is large enough that even the root's
  // direct children stay collapsed; only the root itself starts open.
  const maxDepth = root.count > COLLAPSE_DEEP_ABOVE ? 1 : root.count > COLLAPSE_ABOVE ? 2 : Infinity;
  const walk = (n: FocusNode, depth: number) => {
    if (!n.hasChildren) return;
    if (depth < maxDepth) defaultExpanded.add(n.key);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return { root, defaultExpanded };
}

export const focusChildren = (n: FocusNode): FocusNode[] => n.children;
