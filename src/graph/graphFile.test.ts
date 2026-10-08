import { describe, expect, it } from 'vitest';
import { buildGraphFile } from './buildGraphFile';
import { Graph } from './Graph';
import { LoadError, parseGraphFile, provenanceOf } from './graphFile';
import { Tag } from './tags';

const SHA = 'fd5bfb49cac0b48b994a163effb4c3a1cc14d81d';
const good = () =>
  JSON.parse(
    JSON.stringify(
      buildGraphFile(
        [
          { id: 'a/x', desc: '', tags: Tag.JS, runtime: ['a/y'], dev: [], native: [] },
          { id: 'a/y', desc: '', tags: Tag.JS, runtime: [], dev: ['a/x'], native: [] },
        ],
        SHA,
      ),
    ),
  );

describe('parseGraphFile', () => {
  it('accepts a well-formed file', () => {
    expect(parseGraphFile(good())).not.toBeInstanceOf(LoadError);
  });

  // One malformed fixture per rule.
  const broken: Array<[string, (f: any) => unknown]> = [
    ['not an object', () => 'nope'],
    ['an unknown version', (f) => ({ ...f, version: 2 })],
    ['a missing source', (f) => ({ ...f, source: undefined })],
    ['a missing generatedAt', (f) => ({ ...f, generatedAt: 7 })],
    ['ids that are not strings', (f) => ({ ...f, ids: [1, 2, 3] })],
    ['unsorted ids', (f) => ({ ...f, ids: [...f.ids].reverse() })],
    ['duplicate ids', (f) => ({ ...f, ids: [f.ids[0], f.ids[0], f.ids[2]] })],
    ['desc of the wrong length', (f) => ({ ...f, desc: f.desc.slice(1) })],
    ['tags of the wrong length', (f) => ({ ...f, tags: [...f.tags, 0] })],
    ['a missing CSR', (f) => ({ ...f, native: undefined })],
    ['offsets of the wrong length', (f) => ({ ...f, runtime: { ...f.runtime, offsets: f.runtime.offsets.slice(1) } })],
    ['offsets that do not start at 0', (f) => ({ ...f, dev: { offsets: f.dev.offsets.map((o: number) => o + 1), targets: [...f.dev.targets, 0] } })],
    ['offsets that go backwards', (f) => ({ ...f, runtime: { offsets: [0, 1, 0, 1], targets: [2] } })],
    ['offsets that do not end at targets.length', (f) => ({ ...f, runtime: { ...f.runtime, targets: [...f.runtime.targets, 0] } })],
    ['a target out of range', (f) => ({ ...f, runtime: { ...f.runtime, targets: [99] } })],
    ['a fractional target', (f) => ({ ...f, runtime: { ...f.runtime, targets: [0.5] } })],
  ];
  it.each(broken)('rejects %s', (_, mutate) => {
    const r = parseGraphFile(mutate(good()));
    expect(r).toBeInstanceOf(LoadError);
  });
});

describe('provenanceOf', () => {
  it('names the commit only for a full SHA', () => {
    const f = good();
    expect(provenanceOf(f)).toEqual({ commit: SHA, dirty: false, dirtyFileCount: 0, generatedAt: f.generatedAt });
    expect(provenanceOf({ ...good(), source: 'unknown' }).commit).toBeNull();
  });

  it('carries a dirty build', () => {
    expect(provenanceOf({ ...good(), sourceDirty: true, dirtyFileCount: 3 })).toMatchObject({ dirty: true, dirtyFileCount: 3 });
  });
});

describe('Graph.load', () => {
  it('builds a Graph from any source of JSON', async () => {
    const g = await Graph.load(async () => good());
    expect(g.n).toBe(3);
    expect(g.provenance.commit).toBe(SHA);
  });

  it('throws the LoadError for a malformed file', async () => {
    await expect(Graph.load(async () => ({ ...good(), version: 9 }))).rejects.toBeInstanceOf(LoadError);
  });
});
