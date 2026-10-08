import { EDGE_KINDS, type GraphFile } from './types';

/** graph.json failed a check; the message is for developers, not visitors. */
export class LoadError extends Error {
  name = 'LoadError';
}

export interface Provenance {
  /** The stdlib commit the file was extracted from, or null when it was not a full SHA. */
  commit: string | null;
  /** The checkout had uncommitted or untracked changes under lib/node_modules/@stdlib. */
  dirty: boolean;
  dirtyFileCount: number;
  generatedAt: string;
}

const FULL_SHA = /^[0-9a-f]{40}$/;

export function provenanceOf(file: GraphFile): Provenance {
  return {
    commit: FULL_SHA.test(file.source) ? file.source : null,
    dirty: file.sourceDirty === true,
    dirtyFileCount: file.dirtyFileCount ?? 0,
    generatedAt: file.generatedAt,
  };
}

/** Check everything Graph relies on, so a bad file fails here instead of rendering nonsense. */
export function parseGraphFile(json: unknown): GraphFile | LoadError {
  const fail = (why: string) => new LoadError(`graph.json: ${why}`);
  if (typeof json !== 'object' || json === null) return fail('not an object');
  const f = json as Record<string, unknown>;
  if (f.version !== 1) return fail(`unsupported version ${String(f.version)}`);
  if (typeof f.source !== 'string' || typeof f.generatedAt !== 'string') return fail('source and generatedAt must be strings');
  const { ids, desc, tags } = f;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) return fail('ids must be strings');
  for (let i = 1; i < ids.length; i++) if (!(ids[i - 1] < ids[i])) return fail(`ids not sorted and unique at ${i}`);
  const n = ids.length;
  if (!Array.isArray(desc) || desc.length !== n) return fail(`desc must have ${n} entries`);
  if (!Array.isArray(tags) || tags.length !== n) return fail(`tags must have ${n} entries`);
  for (const kind of EDGE_KINDS) {
    const csr = f[kind] as { offsets?: unknown; targets?: unknown } | undefined;
    const offsets = csr?.offsets;
    const targets = csr?.targets;
    if (!Array.isArray(offsets) || !Array.isArray(targets)) return fail(`${kind} is not a CSR`);
    if (offsets.length !== n + 1) return fail(`${kind}.offsets must have ${n + 1} entries`);
    if (offsets[0] !== 0 || offsets[n] !== targets.length) return fail(`${kind}.offsets must run from 0 to ${targets.length}`);
    for (let i = 0; i < n; i++) if (!(offsets[i] <= offsets[i + 1])) return fail(`${kind}.offsets go backwards at ${i}`);
    for (const t of targets) if (!Number.isInteger(t) || t < 0 || t >= n) return fail(`${kind} target ${t} out of range`);
  }
  return json as GraphFile;
}
