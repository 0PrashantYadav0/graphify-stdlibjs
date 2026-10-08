// Validate public/data/graph.json the way the app will: through Graph.load, read from disk.
// Fails (exit 1) on a malformed file; only warns on a runtime or native cycle, which the
// app handles but which stdlib has never had.
import fs from 'node:fs';
import { Graph } from '../../src/graph/Graph';
import type { EdgeKind } from '../../src/graph/types';

const file = process.argv[2] ?? 'public/data/graph.json';

/** Packages left over after peeling off everything with no remaining dependencies (Kahn). */
function onCycles(graph: Graph, kind: EdgeKind): number {
  const out = { kinds: [kind], dir: 'requires' } as const;
  const left = Array.from({ length: graph.n }, (_, i) => graph.degree(i, out));
  const queue = left.flatMap((d, i) => (d === 0 ? [i] : []));
  let peeled = 0;
  while (queue.length) {
    const i = queue.pop()!;
    peeled++;
    for (const p of graph.neighbours(i, { kinds: [kind], dir: 'requiredBy' })) if (--left[p] === 0) queue.push(p);
  }
  return graph.n - peeled;
}

try {
  const graph = await Graph.load(() => Promise.resolve(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown));
  const { commit, dirty, generatedAt } = graph.provenance;
  console.log(
    `${file} ok: ${graph.n} packages, runtime ${graph.edgeCount('runtime')}, dev ${graph.edgeCount('dev')}, native ${graph.edgeCount('native')}; ` +
      `commit ${commit ?? 'unknown'}${dirty ? ' (dirty)' : ''}, generated ${generatedAt}`,
  );
  for (const kind of ['runtime', 'native'] as const) {
    const stuck = onCycles(graph, kind);
    if (stuck) console.warn(`::warning::${kind} edges now have a cycle: ${stuck} packages sit on or behind one`);
  }
} catch (err) {
  console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
