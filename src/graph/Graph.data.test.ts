import { readFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { Graph, type EdgeQuery } from './Graph';
import { EDGE_KINDS, type EdgeKind, type GraphFile } from './types';

// Invariants over the committed graph.json, for every package. No pinned figures:
// the weekly data refresh moves every number, but none of these may ever break.
const file = JSON.parse(readFileSync(new URL('../../public/data/graph.json', import.meta.url), 'utf8')) as GraphFile;
const graph = new Graph(file);

function hasEdge(kinds: readonly EdgeKind[], from: number, to: number): boolean {
  return kinds.some((k) => {
    const { offsets, targets } = file[k];
    for (let x = offsets[from]; x < offsets[from + 1]; x++) if (targets[x] === to) return true;
    return false;
  });
}

const queries: EdgeQuery[] = [...EDGE_KINDS.map((k) => [k]), EDGE_KINDS].flatMap((kinds) => [
  { kinds, dir: 'requires' as const },
  { kinds, dir: 'requiredBy' as const },
]);

describe('web over the committed graph', () => {
  it.each(queries.map((q) => [`${q.kinds.join('+')} ${q.dir}`, q] as const))('holds its invariants: %s', (_, q) => {
    for (let i = 0; i < graph.n; i++) {
      const web = graph.web(i, q);
      if (web.size !== web.order.length) throw new Error(`${graph.ids[i]}: size ${web.size} but ${web.order.length} in order`);
      for (const j of web.order) {
        const p = web.via[j];
        if (web.depth[p] !== web.depth[j] - 1) throw new Error(`${graph.ids[j]} sits ${web.depth[j]} out but its via is ${web.depth[p]} out`);
        const [from, to] = q.dir === 'requires' ? [p, j] : [j, p];
        if (!hasEdge(q.kinds, from, to)) throw new Error(`no ${q.kinds} edge ${graph.ids[from]} -> ${graph.ids[to]}`);
      }
      if (web.size > 0 && web.chain(web.order[web.size - 1])[0] !== i) throw new Error(`${graph.ids[i]}: chain does not start at the package`);
    }
  });
});
