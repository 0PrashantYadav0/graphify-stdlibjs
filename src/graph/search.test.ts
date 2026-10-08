import { describe, expect, it } from 'vitest';
import { createSearch, scoreMatch } from './search';

const ids = ['math/base/special/log', 'math/base/special/logf', 'math/base/special/log10f', 'stats/base/ndarray/svariancepn', 'utils/try-require'];
const desc = ['Natural logarithm.', 'Natural logarithm (single-precision).', 'Common logarithm (single-precision).', 'Variance using a one-pass algorithm.', 'Wrap require in a try/catch block.'];
const search = createSearch(ids, desc);
const names = (q: string) => search(q).hits.map((h) => ids[h.index]);

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
  it('returns nothing for an empty query, respects limit, and counts every match', () => {
    expect(search('')).toEqual({ hits: [], total: 0 });
    const r = search('log', 1);
    expect(r.hits).toHaveLength(1);
    expect(r.total).toBe(3);
  });
  it('searches descriptions, ranking them below every id match', () => {
    const r = search('precision');
    expect(r.hits.map((h) => [ids[h.index], h.field])).toEqual([
      ['math/base/special/logf', 'desc'],
      ['math/base/special/log10f', 'desc'],
    ]);
    // 'variance' is in an id and nowhere else; 'try' is in an id and a description: the id wins.
    expect(search('try').hits.map((h) => [ids[h.index], h.field])).toEqual([['utils/try-require', 'id']]);
    expect(search('arithm').hits.every((h) => h.field === 'desc')).toBe(true);
    expect(search('log').hits.every((h) => h.score > 10)).toBe(true);
  });
});

describe('match ranges', () => {
  const ranges = (q: string, id: string) => search(q, 50).hits.find((h) => ids[h.index] === id)?.ranges;
  it('marks a last-segment prefix', () => expect(ranges('lo', 'math/base/special/logf')).toEqual([[18, 20]]));
  it('marks a segment prefix', () => expect(ranges('spec', 'math/base/special/logf')).toEqual([[10, 14]]));
  it('marks a substring', () => expect(ranges('ecial', 'math/base/special/logf')).toEqual([[12, 17]]));
  it('marks each run of a subsequence', () => expect(ranges('logf', 'math/base/special/log10f')).toEqual([[18, 21], [23, 24]]));
  it('marks a description match in the description', () => expect(ranges('single', 'math/base/special/logf')).toEqual([[19, 25]]));
});
