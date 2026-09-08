export const PREFIXES = ['sdsnan', 'dsnan', 'dnan', 'snan', 'sds', 'ds', 'd', 's', 'z', 'c', 'g'];
export const SUFFIXES = ['kbn2', 'kbn', 'ors', 'pw', 'mtk', 'ch', 'tk', 'wd', 'yc', 'pn'];
export const PREFIX_ORDER = ['', 'd', 's', 'dnan', 'snan', 'ds', 'sds', 'dsnan', 'sdsnan', 'z', 'c', 'g'];
const MIN_STEM = 3;
const MIN_GROUP = 2;

export const PREFIX_LABEL: Record<string, string> = {
  '': 'base',
  d: 'float64 (d)',
  s: 'float32 (s)',
  dnan: 'float64 with NaN (dnan)',
  snan: 'float32 with NaN (snan)',
  ds: 'float32 in, float64 accumulate (ds)',
  sds: 'float32 with float64 accumulate (sds)',
  dsnan: 'float32 in, float64 accumulate, NaN (dsnan)',
  sdsnan: 'float32, float64 accumulate, NaN (sdsnan)',
  z: 'complex128 (z)',
  c: 'complex64 (c)',
  g: 'generic (g)',
};

export const SUFFIX_LABEL: Record<string, string> = {
  kbn: 'Kahan–Babuška–Neumaier',
  kbn2: 'second-order KBN',
  ors: 'ordinary recursive',
  pw: 'pairwise',
  pn: 'two-pass',
  ch: 'Chan',
  tk: 'textbook',
  wd: 'Welford',
  yc: 'Youngs–Cramer',
  mtk: 'textbook, known mean',
};

export interface Decomposition {
  prefix: string;
  stem: string;
  suffix: string;
}

export interface VariantMember {
  name: string;
  suffix: string;
  sublabel: string;
}

export interface VariantBucket {
  prefix: string;
  label: string;
  members: VariantMember[];
}

export interface OperationGroup {
  stem: string;
  variants: VariantBucket[];
  size: number;
}

export interface VariantResult {
  groups: OperationGroup[];
  singles: string[];
}

export function decompositions(name: string): Decomposition[] {
  const out: Decomposition[] = [];
  for (const prefix of ['', ...PREFIXES]) {
    if (!name.startsWith(prefix)) continue;
    for (const suffix of ['', ...SUFFIXES]) {
      if (!name.endsWith(suffix)) continue;
      const stem = name.slice(prefix.length, name.length - suffix.length);
      if (stem.length < MIN_STEM || stem.startsWith('-') || stem.endsWith('-')) continue;
      out.push({ prefix, stem, suffix });
    }
  }
  return out;
}

const byName = (a: { name: string }, b: { name: string }): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

export function groupVariants(names: string[]): VariantResult {
  const options = new Map<string, Decomposition[]>();
  const stemCount = new Map<string, number>();
  for (const name of names) {
    const ds = decompositions(name);
    options.set(name, ds);
    for (const stem of new Set(ds.map((d) => d.stem))) stemCount.set(stem, (stemCount.get(stem) ?? 0) + 1);
  }

  const chosen = new Map<string, Decomposition>();
  for (const name of names) {
    const ds = options.get(name)!;
    if (ds.length === 0) continue;
    ds.sort(
      (a, b) =>
        stemCount.get(b.stem)! - stemCount.get(a.stem)! ||
        a.stem.length - b.stem.length ||
        a.prefix.length - b.prefix.length,
    );
    chosen.set(name, ds[0]);
  }

  const byStem = new Map<string, string[]>();
  for (const [name, d] of chosen) {
    const list = byStem.get(d.stem);
    if (list) list.push(name);
    else byStem.set(d.stem, [name]);
  }

  const groups: OperationGroup[] = [];
  const grouped = new Set<string>();
  for (const [stem, members] of byStem) {
    if (members.length < MIN_GROUP) continue;
    const marked = members.some((n) => {
      const d = chosen.get(n)!;
      return d.prefix !== '' || d.suffix !== '';
    });
    if (!marked) continue;
    const buckets = new Map<string, VariantBucket>();
    for (const name of members) {
      const d = chosen.get(name)!;
      let bucket = buckets.get(d.prefix);
      if (!bucket) {
        bucket = { prefix: d.prefix, label: PREFIX_LABEL[d.prefix], members: [] };
        buckets.set(d.prefix, bucket);
      }
      bucket.members.push({ name, suffix: d.suffix, sublabel: d.suffix ? SUFFIX_LABEL[d.suffix] : '' });
      grouped.add(name);
    }
    const variants = [...buckets.values()].sort((a, b) => PREFIX_ORDER.indexOf(a.prefix) - PREFIX_ORDER.indexOf(b.prefix));
    for (const v of variants) v.members.sort(byName);
    groups.push({ stem, variants, size: members.length });
  }
  groups.sort((a, b) => (a.stem < b.stem ? -1 : a.stem > b.stem ? 1 : 0));
  const singles = names.filter((n) => !grouped.has(n)).sort();
  return { groups, singles };
}
