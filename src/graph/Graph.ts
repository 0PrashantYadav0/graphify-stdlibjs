import type { Csr, EdgeKind, GraphFile } from './types';

export function lowerBound(arr: string[], key: string): number {
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
  readonly ids: string[];
  readonly desc: string[];
  readonly tags: number[];
  readonly source: string;
  private readonly index = new Map<string, number>();
  private readonly fwd: Record<EdgeKind, Csr>;
  private readonly rev: Record<EdgeKind, Csr>;
  private readonly rootChildren: number[] = [];

  constructor(file: GraphFile) {
    this.ids = file.ids;
    this.desc = file.desc;
    this.tags = file.tags;
    this.source = file.source;
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

  private row(csr: Csr, i: number): number[] {
    return csr.targets.slice(csr.offsets[i], csr.offsets[i + 1]);
  }

  deps(i: number, kind: EdgeKind): number[] {
    return this.row(this.fwd[kind], i);
  }

  dependents(i: number, kind: EdgeKind): number[] {
    return this.row(this.rev[kind], i);
  }
}
