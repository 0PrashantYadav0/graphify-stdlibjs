import { describe, expect, it } from 'vitest';
import { decompositions, groupVariants } from './variants';

describe('decompositions', () => {
  it('enumerates prefix/stem/suffix splits with a stem of at least 3 chars', () => {
    expect(decompositions('dsumkbn')).toEqual(
      expect.arrayContaining([
        { prefix: '', stem: 'dsumkbn', suffix: '' },
        { prefix: 'd', stem: 'sum', suffix: 'kbn' },
        { prefix: 'd', stem: 'sumkbn', suffix: '' },
        { prefix: '', stem: 'dsum', suffix: 'kbn' },
      ]),
    );
    expect(decompositions('dsumkbn').some((d) => d.prefix === 'ds' && d.suffix === 'kbn')).toBe(false); // 'um' is too short
  });
  it('rejects stems that start or end with a hyphen', () => {
    expect(decompositions('d-foo').some((d) => d.prefix === 'd')).toBe(false);
  });
});

describe('groupVariants', () => {
  it('groups the sum family into ordered variants with algorithm sublabels', () => {
    const { groups, singles } = groupVariants(['sum', 'dsum', 'dsumkbn', 'dsumkbn2', 'dsumors', 'dsumpw', 'ssum', 'dnansum', 'snansum', 'gsum', 'zsum', 'csum', 'index-of']);
    expect(singles).toEqual(['index-of']);
    expect(groups).toHaveLength(1);
    const sum = groups[0];
    expect(sum.stem).toBe('sum');
    expect(sum.size).toBe(12);
    expect(sum.variants.map((v) => v.prefix)).toEqual(['', 'd', 's', 'dnan', 'snan', 'z', 'c', 'g']);
    expect(sum.variants[1].label).toBe('float64 (d)');
    expect(sum.variants[1].members.map((m) => m.name)).toEqual(['dsum', 'dsumkbn', 'dsumkbn2', 'dsumors', 'dsumpw']);
    expect(sum.variants[1].members[1].sublabel).toBe('Kahan–Babuška–Neumaier');
    expect(sum.variants[0].members[0]).toEqual({ name: 'sum', suffix: '', sublabel: '' });
    expect(sum.variants[3].label).toBe('float64 with NaN (dnan)');
  });

  it('picks the most common stem among siblings, so dsumors is d+sum+ors not ds+um+ors', () => {
    const { groups } = groupVariants(['dsum', 'dsumors', 'ssum', 'dssum']);
    expect(groups[0].stem).toBe('sum');
    expect(groups[0].variants.map((v) => v.prefix)).toEqual(['d', 's', 'ds']);
    expect(groups[0].variants[0].members.map((m) => m.name)).toEqual(['dsum', 'dsumors']);
  });

  it('prefers the shorter stem on a count tie, so dasumpw/gasumpw/sasumpw share stem asum', () => {
    const { groups } = groupVariants(['dasumpw', 'gasumpw', 'sasumpw']);
    expect(groups).toHaveLength(1);
    expect(groups[0].stem).toBe('asum');
    expect(groups[0].variants.flatMap((v) => v.members.map((m) => m.sublabel))).toEqual(['pairwise', 'pairwise', 'pairwise']);
  });

  it('keeps stdev and nan-aware stdev in one group and leaves unprefixed oddities single', () => {
    const { groups, singles } = groupVariants(['stdev', 'dstdev', 'sstdev', 'nanstdev', 'dnanstdev']);
    expect(groups.map((g) => g.stem)).toEqual(['stdev']);
    expect(groups[0].variants.map((v) => [v.prefix, v.members.map((m) => m.name)])).toEqual([
      ['', ['stdev']],
      ['d', ['dstdev']],
      ['s', ['sstdev']],
      ['dnan', ['dnanstdev']],
    ]);
    expect(singles).toEqual(['nanstdev']);
  });

  it('does not group names that only share a stem without any prefix or suffix', () => {
    const { groups, singles } = groupVariants(['copy', 'copy2', 'fill', 'sort']);
    expect(groups).toEqual([]);
    expect(singles).toEqual(['copy', 'copy2', 'fill', 'sort']);
  });

  it('returns groups sorted by stem and an empty result for no names', () => {
    const { groups } = groupVariants(['dvariance', 'svariance', 'dmean', 'smean']);
    expect(groups.map((g) => g.stem)).toEqual(['mean', 'variance']);
    expect(groupVariants([])).toEqual({ groups: [], singles: [] });
  });
});
