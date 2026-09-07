import { describe, expect, it } from 'vitest';
import { createSearch, highlightRange, scoreMatch } from './search';

const ids = ['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f', 'stats/base/ndarray/svariancepn', 'utils/try-require'];
const search = createSearch(ids);
const names = (q: string) => search(q).map((h) => ids[h.index]);

describe('scoreMatch', () => {
  it('ranks exact > last-segment prefix > segment prefix > substring > subsequence', () => {
    expect(scoreMatch('math/base/special/logf', 'logf')).toBe(100);
    expect(scoreMatch('math/base/special/logf', 'lo')).toBe(80);
    expect(scoreMatch('math/base/special/logf', 'spec')).toBe(60);
    expect(scoreMatch('math/base/special/logf', 'ecial')).toBe(40);
    expect(scoreMatch('math/base/special/log10f', 'logf')).toBe(20);
    expect(scoreMatch('math/base/special/logf', 'zzz')).toBe(0);
  });
});

describe('createSearch', () => {
  it('returns the exact match first, then fuzzy matches', () => {
    expect(names('logf')).toEqual(['math/base/special/logf', 'math/base/special/log10f']);
  });
  it('breaks score ties by shorter id', () => {
    expect(names('log')).toEqual(['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f']);
  });
  it('supports slashes in the query', () => {
    expect(names('special/log')[0]).toBe('math/base/special/log');
    expect(names('special/log')).toHaveLength(3);
  });
  it('is case-insensitive and trims', () => {
    expect(names('  SVARIANCEPN ')).toEqual(['stats/base/ndarray/svariancepn']);
  });
  it('returns nothing for an empty query and respects limit', () => {
    expect(search('')).toEqual([]);
    expect(search('log', 1)).toHaveLength(1);
  });
});

describe('highlightRange', () => {
  it('returns the substring range when present, else the last-segment prefix range', () => {
    expect(highlightRange('math/base/special/logf', 'spec')).toEqual([10, 14]);
    expect(highlightRange('math/base/special/log10f', 'logf')).toBeNull();
  });
});
