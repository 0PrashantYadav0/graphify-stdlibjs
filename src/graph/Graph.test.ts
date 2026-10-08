import { describe, expect, it } from 'vitest';
import { lowerBound, reverseCsr } from './Graph';
import { graphFromIds } from './testUtils';

const g = graphFromIds(
  ['assert/is-nan', 'math', 'math/base/special', 'math/base/special/lnf', 'math/base/special/logf'],
  { runtime: [['math/base/special/logf', 'math/base/special/lnf']], dev: [['math/base/special/logf', 'assert/is-nan']] },
);
const at = (id: string) => g.indexOf(id);

describe('Graph hierarchy', () => {
  it('lists root children (ids without a slash)', () => {
    expect(g.children(-1).map((i) => g.ids[i])).toEqual(['assert', 'math']);
  });
  it('lists direct children only', () => {
    expect(g.children(at('math/base/special')).map((i) => g.ids[i])).toEqual(['math/base/special/lnf', 'math/base/special/logf']);
    expect(g.children(at('math')).map((i) => g.ids[i])).toEqual(['math/base']);
    expect(g.children(at('math/base/special/lnf'))).toEqual([]);
  });
  it('finds parent and name', () => {
    expect(g.parent(at('math/base/special/logf'))).toBe(at('math/base/special'));
    expect(g.parent(at('math'))).toBe(-1);
    expect(g.name(at('math/base/special/logf'))).toBe('logf');
  });
  it('counts descendants', () => {
    expect(g.descendantCount(at('math'))).toBe(4);
    expect(g.descendantCount(-1)).toBe(g.n);
  });
  it('returns -1 for unknown ids', () => {
    expect(g.indexOf('nope')).toBe(-1);
  });
});

describe('Graph edges', () => {
  it('lists neighbours in either direction for one kind', () => {
    const logf = at('math/base/special/logf');
    expect(g.neighbours(logf, { kinds: ['runtime'], dir: 'requires' })).toEqual([at('math/base/special/lnf')]);
    expect(g.neighbours(at('math/base/special/lnf'), { kinds: ['runtime'], dir: 'requiredBy' })).toEqual([logf]);
    expect(g.neighbours(at('assert/is-nan'), { kinds: ['dev'], dir: 'requiredBy' })).toEqual([logf]);
    expect(g.neighbours(at('assert/is-nan'), { kinds: ['runtime'], dir: 'requiredBy' })).toEqual([]);
    expect(g.neighbours(logf, { kinds: ['native'], dir: 'requires' })).toEqual([]);
  });

  // a -> b and c -> a at runtime; a -> c and d -> a in dev; a -> b again natively
  const n4 = graphFromIds(['a', 'b', 'c', 'd'], {
    runtime: [['a', 'b'], ['c', 'a']],
    dev: [['a', 'c'], ['d', 'a']],
    native: [['a', 'b']],
  });
  const all = ['runtime', 'dev', 'native'] as const;

  it('unions neighbours across kinds without double counting, sorted', () => {
    const a = n4.indexOf('a');
    expect(n4.neighbours(a, { kinds: all, dir: 'requires' })).toEqual([n4.indexOf('b'), n4.indexOf('c')]);
    expect(n4.neighbours(a, { kinds: all, dir: 'requiredBy' })).toEqual([n4.indexOf('c'), n4.indexOf('d')]);
  });

  it('counts degree, and the edges of each kind', () => {
    const a = n4.indexOf('a');
    expect(n4.degree(a, { kinds: ['runtime'], dir: 'requires' })).toBe(1);
    expect(n4.degree(a, { kinds: all, dir: 'requires' })).toBe(2);
    expect(n4.degree(a, { kinds: [], dir: 'requires' })).toBe(0);
    expect([n4.edgeCount('runtime'), n4.edgeCount('dev'), n4.edgeCount('native')]).toEqual([2, 2, 1]);
  });
});

describe('Graph web', () => {
  // runtime: a -> b, a -> c, b -> d, c -> d (a diamond), d -> e
  // dev:     e -> a (closes a cycle through the union), f -> a
  const w = graphFromIds(['a', 'b', 'c', 'd', 'e', 'f'], {
    runtime: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']],
    dev: [['e', 'a'], ['f', 'a']],
  });
  const [a, b, c, d, e, f] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => w.indexOf(id));

  it('lists every package once, at its shortest distance, the start excluded', () => {
    const web = w.web(a, { kinds: ['runtime'], dir: 'requires' });
    expect([...web.order]).toEqual([b, c, d, e]);
    expect([b, c, d, e, a, f].map((j) => web.depth[j])).toEqual([1, 1, 2, 3, 0, -1]);
    expect(web.via[a]).toBe(-1);
    expect(web.via[f]).toBe(-1);
    expect(web.size).toBe(4);
    expect(web.maxDepth).toBe(3);
  });

  it('breaks ties toward the lower index, so the chain is stable', () => {
    const web = w.web(a, { kinds: ['runtime'], dir: 'requires' });
    expect(web.via[d]).toBe(b);
    expect(web.chain(e)).toEqual([a, b, d, e]);
    expect(web.chain(a)).toEqual([a]);
    expect(web.chain(f)).toEqual([]);
  });

  it('walks the other way for requiredBy', () => {
    const web = w.web(e, { kinds: ['runtime'], dir: 'requiredBy' });
    expect([...web.order]).toEqual([d, b, c, a]);
    expect(web.chain(a)).toEqual([e, d, b, a]);
  });

  it('terminates on a cycle through the union of kinds and never revisits the start', () => {
    const web = w.web(a, { kinds: ['runtime', 'dev'], dir: 'requires' });
    expect([...web.order]).toEqual([b, c, d, e]);
    expect(w.web(a, { kinds: ['dev'], dir: 'requiredBy' }).size).toBe(2);
  });

  it('normalises kinds, and an empty kind list is an empty web', () => {
    const one = w.web(a, { kinds: ['runtime', 'dev'], dir: 'requiredBy' });
    const two = w.web(a, { kinds: ['dev', 'runtime', 'dev'], dir: 'requiredBy' });
    expect([...two.order]).toEqual([...one.order]);
    const none = w.web(a, { kinds: [], dir: 'requires' });
    expect([none.size, none.maxDepth, none.order.length]).toEqual([0, 0, 0]);
  });

  it('webSize agrees with web().size for every package', () => {
    for (let i = 0; i < w.n; i++) {
      for (const dir of ['requires', 'requiredBy'] as const) {
        const q = { kinds: ['runtime', 'dev'] as const, dir };
        expect(w.webSize(i, q)).toBe(w.web(i, q).size);
      }
    }
  });
});

describe('Graph namespaces', () => {
  it('counts packages with packages nested under them, not bookkeeping folders', () => {
    // 'math' and 'math/base' are filled in as folders; 'math/base/special' is a real package
    const ns = graphFromIds(['math/base/special', 'math/base/special/lnf', 'math/base/special/logf']);
    expect(ns.namespaceCount()).toBe(1);
  });
});

describe('helpers', () => {
  it('lowerBound finds the first index >= key', () => {
    expect(lowerBound(['a', 'b', 'd'], 'c')).toBe(2);
    expect(lowerBound(['a', 'b', 'd'], 'a')).toBe(0);
    expect(lowerBound(['a', 'b', 'd'], 'z')).toBe(3);
  });
  it('reverseCsr transposes with sorted rows', () => {
    const rev = reverseCsr({ offsets: [0, 1, 3, 3], targets: [2, 0, 2] }, 3);
    expect(rev).toEqual({ offsets: [0, 1, 1, 3], targets: [1, 0, 1] });
  });
});
