import type { EdgeQuery, Graph, Web } from '../graph/Graph';

export interface Column {
  /** Steps from the package; column 0 is the package itself. */
  depth: number;
  /** Package indices in this column that pass the filter, ascending (so in id order). */
  rows: number[];
  /** Packages in this column before filtering. */
  total: number;
}

/** One column per distance; every package of the web appears in exactly one. */
export function webColumns(web: Web, start: number, match?: (i: number) => boolean): Column[] {
  const cols: Column[] = [{ depth: 0, rows: [start], total: 1 }];
  for (let d = 1; d <= web.maxDepth; d++) cols.push({ depth: d, rows: [], total: 0 });
  // web.order is nearest first and ascending within a distance, so pushing keeps rows sorted.
  for (const j of web.order) {
    const col = cols[web.depth[j]];
    col.total++;
    if (!match || match(j)) col.rows.push(j);
  }
  return cols;
}

/**
 * What links a selected row to its neighbouring columns: `up` pulled it in (one column
 * nearer), `down` is what it pulls in next (one column further). Edges that skip a column
 * are left out; they are shown where they land, by that package's own position.
 */
export function webLinks(graph: Graph, web: Web, q: EdgeQuery, sel: number): { up: Set<number>; down: Set<number> } {
  const d = web.depth[sel];
  const back: EdgeQuery = { kinds: q.kinds, dir: q.dir === 'requires' ? 'requiredBy' : 'requires' };
  return {
    // d - 1 is -1 for the package itself, which is also the depth of everything outside the web.
    up: new Set(d === 0 ? [] : graph.neighbours(sel, back).filter((j) => web.depth[j] === d - 1)),
    down: new Set(graph.neighbours(sel, q).filter((j) => web.depth[j] === d + 1)),
  };
}
