import type { Graph } from '../graph/Graph';
import { buildPathTree, type PathNode } from '../graph/pathTree';
import { describePackage } from '../graphview/describe';
import type { GraphNodeLike } from '../graphview/TreeLayer';

export type Side = 'requires' | 'requiredBy';

export interface FocusNode extends GraphNodeLike {
  path: string;
  children: FocusNode[];
}

/** The key of the focused package itself, shared by both sides as their root. */
export const CENTRE_KEY = 'centre';

const COLLAPSE_ABOVE = 40;
const COLLAPSE_DEEP_ABOVE = 200;

function wrap(graph: Graph, side: Side, n: PathNode): FocusNode {
  const children = n.children.map((c) => wrap(graph, side, c));
  return {
    mask: n.index >= 0 ? graph.tags[n.index] : 0,
    title: describePackage(graph, n.index, n.path || n.label),
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

/**
 * Heaviest groups nearest the centre: a parent sits level with the middle of its children,
 * and the first view is fitted on the centre node, so the largest group goes in the middle
 * and the rest alternate below and above it, smaller as they get further away.
 */
function bySize(n: FocusNode): void {
  const sorted = [...n.children].sort((a, b) => b.count - a.count || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  const out: FocusNode[] = [];
  sorted.forEach((c, i) => (i % 2 === 0 ? out.unshift(c) : out.push(c)));
  n.children = out;
  n.children.forEach(bySize);
}

export function buildSide(graph: Graph, side: Side, indexes: number[]): { root: FocusNode; defaultExpanded: Set<string> } {
  const tree = buildPathTree(indexes.map((i) => graph.ids[i]), (id) => graph.indexOf(id));
  const root = wrap(graph, side, tree);
  if (root.count > COLLAPSE_ABOVE) bySize(root);
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

/** The focused package, drawn at the meeting point of both sides; it opens nothing. */
export function centreNode(graph: Graph, index: number): FocusNode {
  return { key: CENTRE_KEY, label: graph.name(index), path: graph.ids[index], index, kind: 'centre', inert: true, mask: graph.tags[index], title: describePackage(graph, index, graph.ids[index]), hasChildren: false, count: 0, children: [] };
}
