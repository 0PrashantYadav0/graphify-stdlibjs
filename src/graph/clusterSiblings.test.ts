import { describe, expect, it } from 'vitest';
import { clusterSiblings } from './clusterSiblings';

const svariance = ['svariance', 'svariancech', 'svariancepn', 'svariancetk', 'svariancewd', 'svarianceyc', 'svariancemtk'];
const dvariance = ['dvariance', 'dvariancech', 'dvariancepn'];
const others = ['dmax', 'dmin', 'dmean', 'dnanmax', 'smax', 'smin', 'smean', 'ssum', 'dsum', 'zsum', 'csum', 'gsum', 'sabs', 'sabs2', 'dabs', 'dabs2', 'nanmax', 'nanmin', 'range', 'mean'];

describe('clusterSiblings', () => {
  it('leaves short lists alone', () => {
    const out = clusterSiblings(['b', 'a', 'c']);
    expect(out).toEqual([{ kind: 'single', name: 'a' }, { kind: 'single', name: 'b' }, { kind: 'single', name: 'c' }]);
  });

  it('groups siblings sharing a prefix of at least minPrefix chars with at least minGroup members', () => {
    const names = [...svariance, ...dvariance, ...others];
    expect(names.length).toBeGreaterThan(24);
    const out = clusterSiblings(names);
    const groups = out.filter((i) => i.kind === 'group');
    const sv = groups.find((g) => g.kind === 'group' && g.prefix === 'svariance');
    expect(sv && sv.kind === 'group' ? sv.members.sort() : null).toEqual([...svariance].sort());
    const dv = groups.find((g) => g.kind === 'group' && g.prefix === 'dvariance');
    expect(dv && dv.kind === 'group' ? dv.members.length : 0).toBe(3);
    expect(out.length).toBeLessThan(names.length);
    // every input name appears exactly once, as a single or inside a group
    const seen = out.flatMap((i) => (i.kind === 'single' ? [i.name] : i.members));
    expect(seen.sort()).toEqual([...names].sort());
  });

  it('never groups on a prefix shorter than minPrefix', () => {
    const names = Array.from({ length: 30 }, (_, i) => `ab${String.fromCharCode(97 + i)}`); // aba, abb, ...
    const out = clusterSiblings(names, { minPrefix: 3 });
    expect(out.every((i) => i.kind === 'single')).toBe(true);
  });

  it('does not produce a group larger than threshold', () => {
    const names = Array.from({ length: 40 }, (_, i) => `dist${String(i).padStart(2, '0')}`);
    const out = clusterSiblings(names, { threshold: 24 });
    for (const item of out) if (item.kind === 'group') expect(item.members.length).toBeLessThanOrEqual(24);
    const seen = out.flatMap((i) => (i.kind === 'single' ? [i.name] : i.members));
    expect(seen.sort()).toEqual([...names].sort());
  });

  it('returns items sorted by label', () => {
    const names = [...svariance, ...dvariance, ...others];
    const labels = clusterSiblings(names).map((i) => (i.kind === 'single' ? i.name : i.prefix));
    expect(labels).toEqual([...labels].sort());
  });
});
