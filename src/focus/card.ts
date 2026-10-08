import type { Graph } from '../graph/Graph';

// Last segments that are reserved words in stdlib's tree (utils/while, utils/eval, napi/export, …).
const RESERVED = new Set(['with', 'function', 'export', 'while', 'eval', 'for', 'do', 'if', 'new', 'delete', 'in', 'default', 'class', 'import', 'return', 'switch', 'case', 'try', 'void', 'var', 'let', 'const']);

/** `const ctor = require( '@stdlib/ndarray/ctor' );` in stdlib's own spacing style. */
export function requireSnippet(id: string): string {
  let name = id.slice(id.lastIndexOf('/') + 1).replace(/[-.]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase()).replace(/[^\w$]/g, '');
  if (/^\d/.test(name)) name = `_${name}`;
  if (RESERVED.has(name)) name = `${name}Fn`;
  return `const ${name} = require( '@stdlib/${id}' );`;
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const last = (id: string) => id.slice(id.lastIndexOf('/') + 1);

/**
 * Up to three packages a mistyped id probably meant. Search gathers candidates by the whole
 * id and by its last segment; the closest last segment wins, then the closest whole id, so
 * `ndarray/ctr` finds `ndarray/ctor` rather than `blas/ext/base/ndarray/ctril`.
 */
export function didYouMean(graph: Graph, id: string): number[] {
  const seen = new Set([...graph.search(id, 50).hits, ...graph.search(last(id), 500).hits].map((h) => h.index));
  const key = (i: number) => [editDistance(last(id), last(graph.ids[i])), editDistance(id, graph.ids[i])];
  return [...seen]
    .map((i) => ({ i, k: key(i) }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.i - b.i)
    .slice(0, 3)
    .map(({ i }) => i);
}
