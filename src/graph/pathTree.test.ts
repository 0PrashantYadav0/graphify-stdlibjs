import { describe, expect, it } from 'vitest';
import { buildPathTree } from './pathTree';

const ids = ['blas/base/dasum', 'blas/base/daxpy', 'math/base/special/lnf', 'math/base/special', 'utils/noop'];
const indexOf = (id: string) => ids.indexOf(id);

describe('buildPathTree', () => {
  const tree = buildPathTree(ids, indexOf);

  it('collapses single-child chains into one labelled node', () => {
    expect(tree.children.map((c) => c.label)).toEqual(['blas/base', 'math/base/special', 'utils/noop']);
    expect(tree.children[0].path).toBe('blas/base');
    expect(tree.children[0].index).toBe(-1);
  });

  it('keeps a node that is itself a package even when it has one child', () => {
    const special = tree.children[1];
    expect(special.index).toBe(indexOf('math/base/special'));
    expect(special.children.map((c) => c.label)).toEqual(['lnf']);
    expect(special.leafCount).toBe(2);
  });

  it('counts leaves and sorts folders before leaves, alphabetically', () => {
    expect(tree.leafCount).toBe(5);
    expect(tree.children[0].children.map((c) => c.label)).toEqual(['dasum', 'daxpy']);
    expect(tree.children[0].leafCount).toBe(2);
    expect(tree.children[2].index).toBe(indexOf('utils/noop'));
  });

  it('handles an empty list', () => {
    expect(buildPathTree([], indexOf)).toEqual({ label: '', path: '', index: -1, leafCount: 0, children: [] });
  });
});
