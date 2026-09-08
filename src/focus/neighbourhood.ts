import type { Graph } from '../graph/Graph';
import type { EdgeKind } from '../graph/types';

export interface Neighbourhood {
  requires: number[];
  requiredBy: number[];
  connected: number;
}

export function neighbourhood(graph: Graph, index: number, kinds: EdgeKind[]): Neighbourhood {
  const req = new Set<number>();
  const by = new Set<number>();
  for (const kind of kinds) {
    for (const j of graph.deps(index, kind)) req.add(j);
    for (const j of graph.dependents(index, kind)) by.add(j);
  }
  const asc = (a: number, b: number) => a - b;
  return {
    requires: [...req].sort(asc),
    requiredBy: [...by].sort(asc),
    connected: new Set([...req, ...by]).size,
  };
}
