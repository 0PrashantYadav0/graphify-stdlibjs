import { parseGraphFile, provenanceOf, LoadError, type Provenance } from './graphFile';
import { createSearch, type SearchResult } from './search';
import { Tag } from './tags';
import { EDGE_KINDS, type Csr, type EdgeKind, type GraphFile } from './types';

export type Dir = 'requires' | 'requiredBy';

export interface EdgeQuery {
  kinds: readonly EdgeKind[];
  dir: Dir;
}

/**
 * Every package reached from one start package through the queried edges, each listed
 * once at its shortest distance. Arrays are indexed by package and sized `n`.
 */
export interface Web {
  /** Reached packages, nearest first and ascending by index within a distance; the start is excluded. */
  order: Int32Array;
  /** Steps from the start: 0 for the start itself, -1 when not reached. */
  depth: Int32Array;
  /** The package one step nearer the start on the shortest chain (lowest index on a tie); -1 for the start and the unreached. */
  via: Int32Array;
  size: number;
  maxDepth: number;
  /** The shortest chain start … j, or [] when j is not reached. */
  chain(j: number): number[];
}

export function lowerBound(arr: readonly string[], key: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function reverseCsr(csr: Csr, n: number): Csr {
  const offsets = new Array<number>(n + 1).fill(0);
  for (const t of csr.targets) offsets[t + 1]++;
  for (let i = 0; i < n; i++) offsets[i + 1] += offsets[i];
  const fill = offsets.slice(0, n);
  const targets = new Array<number>(csr.targets.length);
  for (let i = 0; i < n; i++) {
    for (let k = csr.offsets[i]; k < csr.offsets[i + 1]; k++) {
      targets[fill[csr.targets[k]]++] = i;
    }
  }
  return { offsets, targets };
}

export class Graph {
  readonly n: number;
  readonly ids: readonly string[];
  readonly desc: readonly string[];
  readonly tags: readonly number[];
  readonly provenance: Provenance;
  private readonly index = new Map<string, number>();
  private readonly fwd: Record<EdgeKind, Csr>;
  private readonly rev: Record<EdgeKind, Csr>;
  private readonly rootChildren: number[] = [];
  private readonly sizes = new Map<string, number>();
  private searcher?: (query: string, limit?: number) => SearchResult;

  constructor(file: GraphFile) {
    this.ids = file.ids;
    this.desc = file.desc;
    this.tags = file.tags;
    this.provenance = provenanceOf(file);
    this.n = file.ids.length;
    file.ids.forEach((id, i) => {
      this.index.set(id, i);
      if (!id.includes('/')) this.rootChildren.push(i);
    });
    this.fwd = { runtime: file.runtime, dev: file.dev, native: file.native };
    this.rev = {
      runtime: reverseCsr(file.runtime, this.n),
      dev: reverseCsr(file.dev, this.n),
      native: reverseCsr(file.native, this.n),
    };
  }

  /** Validate and build from any source of parsed JSON: fetch in the app, fs in scripts, a fixture in tests. */
  static async load(read: () => Promise<unknown>): Promise<Graph> {
    const file = parseGraphFile(await read());
    if (file instanceof LoadError) throw file;
    return new Graph(file);
  }

  /** Ids first, then descriptions; the index is built on the first query and kept. */
  search(query: string, limit?: number): SearchResult {
    this.searcher ??= createSearch(this.ids, this.desc);
    return this.searcher(query, limit);
  }

  indexOf(id: string): number {
    return this.index.get(id) ?? -1;
  }

  name(i: number): string {
    const id = this.ids[i];
    return id.slice(id.lastIndexOf('/') + 1);
  }

  parent(i: number): number {
    const id = this.ids[i];
    const k = id.lastIndexOf('/');
    return k < 0 ? -1 : this.indexOf(id.slice(0, k));
  }

  /** Direct children of node i; pass -1 for the root. */
  children(i: number): number[] {
    if (i < 0) return this.rootChildren.slice();
    const prefix = this.ids[i] + '/';
    const out: number[] = [];
    for (let j = lowerBound(this.ids, prefix); j < this.n && this.ids[j].startsWith(prefix); j++) {
      if (this.ids[j].indexOf('/', prefix.length) < 0) out.push(j);
    }
    return out;
  }

  /** Number of nodes strictly below node i; pass -1 for the root. */
  descendantCount(i: number): number {
    if (i < 0) return this.n;
    const prefix = this.ids[i] + '/';
    const start = lowerBound(this.ids, prefix);
    let j = start;
    while (j < this.n && this.ids[j].startsWith(prefix)) j++;
    return j - start;
  }

  /** Packages that have packages nested under them; bookkeeping folders are not packages. */
  namespaceCount(): number {
    return this.tags.filter((t) => (t & Tag.NAMESPACE) !== 0 && (t & Tag.FOLDER) === 0).length;
  }

  edgeCount(kind: EdgeKind): number {
    return this.fwd[kind].targets.length;
  }

  /** Direct neighbours across the queried kinds: sorted, each once. */
  neighbours(i: number, q: EdgeQuery): number[] {
    const out = new Set<number>();
    for (const { offsets, targets } of this.csrs(q)) {
      for (let k = offsets[i]; k < offsets[i + 1]; k++) out.add(targets[k]);
    }
    return [...out].sort((a, b) => a - b);
  }

  degree(i: number, q: EdgeQuery): number {
    const csrs = this.csrs(q);
    if (csrs.length === 1) return csrs[0].offsets[i + 1] - csrs[0].offsets[i];
    return csrs.length === 0 ? 0 : this.neighbours(i, q).length;
  }

  web(start: number, q: EdgeQuery): Web {
    const csrs = this.csrs(q);
    const depth = new Int32Array(this.n).fill(-1);
    const via = new Int32Array(this.n).fill(-1);
    const order = new Int32Array(this.n);
    depth[start] = 0;
    let size = 0;
    let maxDepth = 0;
    // Level by level, each level ascending, so the first package to reach j -- its via --
    // is the lowest-index one at the nearer distance: the same chain on every render.
    let level = [start];
    while (level.length > 0) {
      const next: number[] = [];
      for (const u of level) {
        for (const { offsets, targets } of csrs) {
          for (let k = offsets[u]; k < offsets[u + 1]; k++) {
            const v = targets[k];
            if (depth[v] >= 0) continue;
            depth[v] = depth[u] + 1;
            via[v] = u;
            next.push(v);
          }
        }
      }
      next.sort((a, b) => a - b);
      order.set(next, size);
      size += next.length;
      if (next.length > 0) maxDepth++;
      level = next;
    }
    return {
      order: order.subarray(0, size),
      depth,
      via,
      size,
      maxDepth,
      chain(j) {
        if (depth[j] < 0) return [];
        const out = [j];
        while (via[out[0]] >= 0) out.unshift(via[out[0]]);
        return out;
      },
    };
  }

  /** web(i, q).size, remembered: a view can ask for every row it renders. */
  webSize(i: number, q: EdgeQuery): number {
    const key = `${this.kindsOf(q).join(',')}|${q.dir}|${i}`;
    let size = this.sizes.get(key);
    if (size === undefined) this.sizes.set(key, (size = this.web(i, q).size));
    return size;
  }

  private kindsOf(q: EdgeQuery): EdgeKind[] {
    return EDGE_KINDS.filter((k) => q.kinds.includes(k));
  }

  private csrs(q: EdgeQuery): Csr[] {
    const side = q.dir === 'requires' ? this.fwd : this.rev;
    return this.kindsOf(q).map((k) => side[k]);
  }
}
