import type { Graph } from '../graph/Graph';

/** What a change to one package can break; the three buckets are disjoint. See CONTEXT.md, "Impact set". */
export interface ImpactSet {
  /** Reach the package through runtime edges: their behaviour can change. */
  runtime: number[];
  /** Reach it through native edges, and are not runtime-affected: their add-on must be rebuilt. */
  rebuild: number[];
  /** Direct dev-dependents of the package or of anything above, not already counted: their tests may break. */
  tests: number[];
}

export const BUCKETS = ['runtime', 'rebuild', 'tests'] as const;
export type Bucket = (typeof BUCKETS)[number];

export function impactSet(graph: Graph, i: number): ImpactSet {
  const runtime = graph.web(i, { kinds: ['runtime'], dir: 'requiredBy' }).order;
  const native = graph.web(i, { kinds: ['native'], dir: 'requiredBy' }).order;
  const counted = new Set<number>([i, ...runtime]);
  const rebuild = [...native].filter((j) => !counted.has(j));
  for (const j of rebuild) counted.add(j);
  const tests = new Set<number>();
  // Dev edges stop after one step: a test that breaks does not change anyone's behaviour.
  for (const j of counted) for (const t of graph.neighbours(j, { kinds: ['dev'], dir: 'requiredBy' })) if (!counted.has(t)) tests.add(t);
  return { runtime: [...runtime].sort((a, b) => a - b), rebuild: rebuild.sort((a, b) => a - b), tests: [...tests].sort((a, b) => a - b) };
}

/** The copyable list: one id per line, grouped by bucket, for a test or CI selection. */
export function impactList(graph: Graph, set: ImpactSet): string {
  return BUCKETS.map((b) => [`# ${b} (${set[b].length})`, ...set[b].map((j) => graph.ids[j]), ''].join('\n')).join('\n');
}
