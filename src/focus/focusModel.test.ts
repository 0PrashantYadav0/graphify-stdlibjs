import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { buildSide } from './focusModel';

const ids = ['blas/base/dasum', 'blas/base/daxpy', 'math/base/special/lnf', 'utils/noop'];
const g = graphFromIds(ids);
const idx = (id: string) => g.indexOf(id);

describe('buildSide', () => {
  it('wraps a path tree into graph nodes with side-prefixed keys', () => {
    const { root, defaultExpanded } = buildSide(g, 'requires', ids.map(idx));
    expect(root.key).toBe('requires:');
    expect(root.children.map((c) => [c.key, c.label, c.hasChildren, c.count])).toEqual([
      ['requires:blas/base', 'blas/base', true, 2],
      ['requires:math/base/special/lnf', 'math/base/special/lnf', false, 0],
      ['requires:utils/noop', 'utils/noop', false, 0],
    ]);
    expect(root.children[0].children.map((c) => c.label)).toEqual(['dasum', 'daxpy']);
    expect(root.children[1].index).toBe(idx('math/base/special/lnf'));
    expect([...defaultExpanded]).toEqual(['requires:', 'requires:blas/base']);
  });

  it('collapses folders below depth 2 when a side has more than 40 leaves', () => {
    const many = Array.from({ length: 45 }, (_, i) => `ns/sub/deep/pkg${i}`);
    const big = graphFromIds(many);
    const { root, defaultExpanded } = buildSide(big, 'requiredBy', many.map((id) => big.indexOf(id)));
    expect(root.children[0].label).toBe('ns/sub/deep');
    expect(defaultExpanded.has('requiredBy:')).toBe(true);
    expect(defaultExpanded.has('requiredBy:ns/sub/deep')).toBe(true);
    const nested = graphFromIds([...many, 'ns/other/x', 'ns/other/y']);
    const r2 = buildSide(nested, 'requiredBy', [...many, 'ns/other/x', 'ns/other/y'].map((id) => nested.indexOf(id)));
    expect(r2.defaultExpanded.has('requiredBy:ns')).toBe(true);
    expect(r2.defaultExpanded.has('requiredBy:ns/sub/deep')).toBe(false);
  });

  it('only expands the root and its direct children when a side has more than 200 leaves', () => {
    // 'a' has two child folders: 'b' (which chains down to 'c') and 'd'.
    const ids = [
      ...Array.from({ length: 200 }, (_, i) => `a/b/c/pkg${i}`),
      ...Array.from({ length: 50 }, (_, i) => `a/d/pkg${i}`),
    ];
    const g = graphFromIds(ids);
    const { root, defaultExpanded } = buildSide(g, 'requiredBy', ids.map((id) => g.indexOf(id)));
    expect(root.count).toBe(250);
    expect([...defaultExpanded]).toEqual(['requiredBy:', 'requiredBy:a']);
    expect(defaultExpanded.has('requiredBy:a/b/c')).toBe(false);
    expect(defaultExpanded.has('requiredBy:a/d')).toBe(false);
  });
});
