import type { Graph } from '../graph/Graph';
import { buildPathTree, type PathNode } from '../graph/pathTree';
import type { GraphNodeLike } from '../graphview/TreeLayer';

export type Side = 'requires' | 'requiredBy';

export interface FocusNode extends GraphNodeLike {
  path: string;
  children: FocusNode[];
}

const COLLAPSE_ABOVE = 40;

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
  const collapseDeep = root.count > COLLAPSE_ABOVE;
  const walk = (n: FocusNode, depth: number) => {
    if (!n.hasChildren) return;
    if (!collapseDeep || depth < 2) defaultExpanded.add(n.key);
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return { root, defaultExpanded };
}

export const focusChildren = (n: FocusNode): FocusNode[] => n.children;
