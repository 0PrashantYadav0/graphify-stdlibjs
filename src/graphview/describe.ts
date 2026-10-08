import type { Graph } from '../graph/Graph';

/** "<full id> — <description>" for a package node; the fallback text for a group. */
export function describePackage(graph: Graph, index: number, fallback: string): string {
  if (index < 0) return fallback;
  const desc = graph.desc[index];
  return desc ? `${graph.ids[index]} — ${desc}` : graph.ids[index];
}
