import { Tag } from './tags';
import type { Csr, GraphFile, PackageInput } from './types';

const EMPTY: PackageInput = { id: '', desc: '', tags: Tag.FOLDER, runtime: [], dev: [], native: [] };

export function buildGraphFile(pkgs: PackageInput[], source: string): GraphFile {
  const byId = new Map<string, PackageInput>();
  for (const p of pkgs) byId.set(p.id, p);
  for (const id of [...byId.keys()]) {
    const parts = id.split('/');
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join('/');
      if (!byId.has(prefix)) byId.set(prefix, { ...EMPTY, id: prefix });
    }
  }
  const ids = [...byId.keys()].sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const hasChild = new Set<string>();
  for (const id of ids) {
    const k = id.lastIndexOf('/');
    if (k > 0) hasChild.add(id.slice(0, k));
  }
  const csr = (pick: (p: PackageInput) => Iterable<string>): Csr => {
    const offsets = [0];
    const targets: number[] = [];
    for (const id of ids) {
      const row: number[] = [];
      for (const t of pick(byId.get(id)!)) {
        const j = index.get(t);
        if (j !== undefined && j !== index.get(id)) row.push(j);
      }
      row.sort((a, b) => a - b);
      for (const j of row) targets.push(j);
      offsets.push(targets.length);
    }
    return { offsets, targets };
  };
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    ids,
    desc: ids.map((id) => byId.get(id)!.desc),
    tags: ids.map((id) => byId.get(id)!.tags | (hasChild.has(id) ? Tag.NAMESPACE : 0)),
    runtime: csr((p) => p.runtime),
    dev: csr((p) => p.dev),
    native: csr((p) => p.native),
  };
}
