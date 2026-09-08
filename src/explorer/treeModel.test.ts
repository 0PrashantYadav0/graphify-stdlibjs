import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { ROOT, TreeModel } from './treeModel';

const ids = [
  'blas/ext/base/sum', 'blas/ext/base/dsum', 'blas/ext/base/dsumkbn', 'blas/ext/base/ssum',
  'blas/ext/base/dsort', 'blas/ext/base/gsort', 'blas/ext/base/index-of',
  'math/base/special/lnf',
];
const g = graphFromIds(ids);
const model = new TreeModel(g);
const keys = (nodes: { key: string }[]) => nodes.map((n) => n.key);

describe('TreeModel.children', () => {
  it('lists root namespaces as package nodes, never clustered', () => {
    const root = model.children(ROOT);
    expect(keys(root)).toEqual(['p:blas', 'p:math']);
    expect(root[0]).toMatchObject({ kind: 'package', label: 'blas', hasChildren: true, count: 9 });
  });

  it('folds variant families into operation → variant → package nodes and keeps the rest as packages', () => {
    const base = model.children({ key: 'p:blas/ext/base', kind: 'package', label: 'base', index: g.indexOf('blas/ext/base'), count: 7, hasChildren: true });
    expect(keys(base)).toEqual(['op:blas/ext/base:sort', 'op:blas/ext/base:sum', 'p:blas/ext/base/index-of']);
    expect(base[1]).toMatchObject({ kind: 'operation', label: 'sum', count: 4, hasChildren: true });
    const variants = model.children(base[1]);
    expect(keys(variants)).toEqual(['v:blas/ext/base:sum:', 'v:blas/ext/base:sum:d', 'v:blas/ext/base:sum:s']);
    expect(variants[1]).toMatchObject({ kind: 'variant', label: 'float64 (d)', count: 2 });
    const d = model.children(variants[1]);
    expect(keys(d)).toEqual(['p:blas/ext/base/dsum', 'p:blas/ext/base/dsumkbn']);
    expect(d[1]).toMatchObject({ kind: 'package', label: 'dsumkbn', sublabel: 'Kahan–Babuška–Neumaier', hasChildren: false, count: 0 });
  });

  it('clusters wide non-root levels but not the root', () => {
    const wide = Array.from({ length: 30 }, (_, i) => `dist${String(i).padStart(2, '0')}`);
    const nonRoot = new TreeModel(graphFromIds(wide.map((n) => `stats/${n}`)));
    const statsNode = nonRoot.children(ROOT)[0];
    const items = nonRoot.children(statsNode);
    expect(items.every((n) => n.kind === 'cluster')).toBe(true);
    expect(items[0].key.startsWith('c:stats:dist')).toBe(true);
    expect(nonRoot.children(items[0]).every((n) => n.kind === 'package')).toBe(true);

    const rootWide = new TreeModel(graphFromIds(wide));
    expect(rootWide.children(ROOT).every((n) => n.kind === 'package')).toBe(true);
    expect(rootWide.children(ROOT)).toHaveLength(30);
  });
});

describe('TreeModel.expandPathFor', () => {
  it('walks through operation and variant nodes to reach a package', () => {
    expect(model.expandPathFor('blas/ext/base/dsumkbn')).toEqual({
      expanded: ['root', 'p:blas', 'p:blas/ext', 'p:blas/ext/base', 'op:blas/ext/base:sum', 'v:blas/ext/base:sum:d'],
      selected: 'p:blas/ext/base/dsumkbn',
    });
  });
  it('expands a namespace path and selects it', () => {
    expect(model.expandPathFor('math/base')).toEqual({ expanded: ['root', 'p:math', 'p:math/base'], selected: 'p:math/base' });
  });
  it('returns just the root for an empty or unknown path', () => {
    expect(model.expandPathFor('')).toEqual({ expanded: ['root'], selected: null });
    expect(model.expandPathFor('nope/x')).toEqual({ expanded: ['root'], selected: null });
  });
});
