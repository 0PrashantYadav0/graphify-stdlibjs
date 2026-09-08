import { describe, expect, it } from 'vitest';
import { graphFromIds } from '../graph/testUtils';
import { columnsForRoute } from './columns';

const small = graphFromIds(['assert/is-nan', 'math/base/special/lnf', 'math/base/special/logf']);

const wideNames = [
  ...['', 'ch', 'pn', 'tk', 'wd', 'yc', 'mtk'].map((s) => `svariance${s}`),
  ...['dmax', 'dmin', 'dmean', 'dnanmax', 'smax', 'smin', 'smean', 'ssum', 'dsum', 'zsum', 'csum', 'gsum', 'sabs', 'sabs2', 'dabs', 'dabs2', 'nanmax', 'nanmin', 'range', 'mean'],
];
const wide = graphFromIds(wideNames.map((n) => `stats/base/ndarray/${n}`));

describe('columnsForRoute', () => {
  it('shows one root column at the root', () => {
    const cols = columnsForRoute(small, '', null);
    expect(cols).toHaveLength(1);
    expect(cols[0].title).toBe('stdlib');
    expect(cols[0].items.map((i) => i.label)).toEqual(['assert', 'math']);
    expect(cols[0].items.every((i) => !i.selected)).toBe(true);
  });

  it('opens one column per path segment and marks the selected box', () => {
    const cols = columnsForRoute(small, 'math/base/special', null);
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'math', 'base', 'special']);
    expect(cols[0].items.find((i) => i.label === 'math')?.selected).toBe(true);
    expect(cols[3].items.map((i) => i.label)).toEqual(['lnf', 'logf']);
    expect(cols[3].parentId).toBe('math/base/special');
    expect(cols[3].total).toBe(2);
  });

  it('stops at an unknown segment', () => {
    expect(columnsForRoute(small, 'math/nope/x', null).map((c) => c.title)).toEqual(['stdlib', 'math']);
  });

  it('inserts a group column when the next segment sits inside a group', () => {
    const cols = columnsForRoute(wide, 'stats/base/ndarray/svariancepn', null);
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'stats', 'base', 'ndarray', 'svariance…', 'svariancepn']);
    const group = cols[3].items.find((i) => i.kind === 'group' && i.prefix === 'svariance');
    expect(group?.selected).toBe(true);
    expect(cols[4].items.find((i) => i.label === 'svariancepn')?.selected).toBe(true);
    expect(cols[4].total).toBe(7);
  });

  it('opens a group column at the end when the route asks for it', () => {
    const cols = columnsForRoute(wide, 'stats/base/ndarray', 'svariance');
    expect(cols.map((c) => c.title)).toEqual(['stdlib', 'stats', 'base', 'ndarray', 'svariance…']);
    expect(cols[4].items.every((i) => !i.selected)).toBe(true);
  });
});
