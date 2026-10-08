import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Graph, type EdgeQuery } from '../graph/Graph';
import { graphFromIds } from '../graph/testUtils';
import { webColumns, webLinks } from './webModel';

// a → b, a → c, b → d, c → d, d → e (runtime). d is reached two ways; it must appear once.
const g = graphFromIds(['p/a', 'p/b', 'p/c', 'p/d', 'p/e', 'q/x'], {
  runtime: [['p/a', 'p/b'], ['p/a', 'p/c'], ['p/b', 'p/d'], ['p/c', 'p/d'], ['p/d', 'p/e']],
});
const at = (id: string) => g.indexOf(id);
const out: EdgeQuery = { kinds: ['runtime'], dir: 'requires' };

describe('webColumns', () => {
  const a = at('p/a');
  const web = g.web(a, out);

  it('puts the package in column 0 and every other package once, in its depth column', () => {
    const cols = webColumns(web, a);
    expect(cols.map((c) => c.rows)).toEqual([[a], [at('p/b'), at('p/c')], [at('p/d')], [at('p/e')]]);
    expect(cols.map((c) => c.depth)).toEqual([0, 1, 2, 3]);
    expect(cols.map((c) => c.total)).toEqual([1, 2, 1, 1]);
  });

  it('filters every column at once but keeps the totals and the package itself', () => {
    const cols = webColumns(web, a, (i) => g.ids[i].endsWith('c') || g.ids[i].endsWith('e'));
    expect(cols.map((c) => c.rows)).toEqual([[a], [at('p/c')], [], [at('p/e')]]);
    expect(cols.map((c) => c.total)).toEqual([1, 2, 1, 1]);
  });
});

describe('webLinks', () => {
  it('links a row to what pulled it in (up) and what it pulls in next (down)', () => {
    const a = at('p/a');
    const web = g.web(a, out);
    expect(webLinks(g, web, out, at('p/d'))).toEqual({ up: new Set([at('p/b'), at('p/c')]), down: new Set([at('p/e')]) });
    expect(webLinks(g, web, out, at('p/b'))).toEqual({ up: new Set([a]), down: new Set([at('p/d')]) });
  });

  it('gives the package itself no up links, even when something outside the web requires it', () => {
    const b = at('p/b');
    expect(webLinks(g, g.web(b, out), out, b)).toEqual({ up: new Set(), down: new Set([at('p/d')]) });
  });

  it('runs the other way for a requiredBy web', () => {
    const e = at('p/e');
    const q: EdgeQuery = { kinds: ['runtime'], dir: 'requiredBy' };
    const web = g.web(e, q);
    expect(webLinks(g, web, q, at('p/d'))).toEqual({ up: new Set([e]), down: new Set([at('p/b'), at('p/c')]) });
  });

  it('only links neighbours one column away, not shortcuts across columns', () => {
    // a → c directly and a → b → c: c sits in column 1, so b (also column 1) is not one of its up links.
    const s = graphFromIds(['p/a', 'p/b', 'p/c'], { runtime: [['p/a', 'p/b'], ['p/a', 'p/c'], ['p/b', 'p/c']] });
    const web = s.web(s.indexOf('p/a'), out);
    expect(webLinks(s, web, out, s.indexOf('p/c')).up).toEqual(new Set([s.indexOf('p/a')]));
    expect(webLinks(s, web, out, s.indexOf('p/b')).down).toEqual(new Set());
  });
});

describe('webColumns over the committed graph', () => {
  const real = new Graph(JSON.parse(readFileSync(new URL('../../public/data/graph.json', import.meta.url), 'utf8')));
  it.each(['ndarray/ctor', 'string/format'])('lists every package of %s once, in its depth column', (id) => {
    const i = real.indexOf(id);
    for (const q of [out, { ...out, dir: 'requiredBy' } as const]) {
      const web = real.web(i, q);
      const cols = webColumns(web, i);
      expect(cols).toHaveLength(web.maxDepth + 1);
      const all = cols.slice(1).flatMap((c) => c.rows);
      expect(all).toHaveLength(web.size);
      expect(new Set(all).size).toBe(web.size);
      for (const c of cols) for (const j of c.rows) expect(web.depth[j]).toBe(c.depth);
    }
  });
});
