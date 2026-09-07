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
  it('reads forward and reverse edges per kind', () => {
    expect(g.deps(at('math/base/special/logf'), 'runtime')).toEqual([at('math/base/special/lnf')]);
    expect(g.dependents(at('math/base/special/lnf'), 'runtime')).toEqual([at('math/base/special/logf')]);
    expect(g.dependents(at('assert/is-nan'), 'dev')).toEqual([at('math/base/special/logf')]);
    expect(g.dependents(at('assert/is-nan'), 'runtime')).toEqual([]);
    expect(g.deps(at('math/base/special/logf'), 'native')).toEqual([]);
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
