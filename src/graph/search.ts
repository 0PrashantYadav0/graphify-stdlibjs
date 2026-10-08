export type Range = [number, number];

export interface SearchHit {
  index: number;
  score: number;
  /** Which text matched: the id, or (only when the id did not) the description. */
  field: 'id' | 'desc';
  /** Matched [start, end) ranges in that text, from the same code that scored it. */
  ranges: Range[];
}

export interface SearchResult {
  hits: SearchHit[];
  /** Every match, before the limit. */
  total: number;
}

/** Any id match outranks this, so a description only ever breaks into the list below them. */
const DESC_SCORE = 10;

/** Both arguments must already be lower-cased. */
export function scoreMatch(idLower: string, q: string): number {
  return matchId(idLower, q)?.score ?? 0;
}

function matchId(id: string, q: string): { score: number; ranges: Range[] } | null {
  const start = id.lastIndexOf('/') + 1;
  const last = id.slice(start);
  if (id === q) return { score: 100, ranges: [[0, id.length]] };
  if (last === q) return { score: 100, ranges: [[start, id.length]] };
  if (last.startsWith(q)) return { score: 80, ranges: [[start, start + q.length]] };
  if (id.startsWith(q)) return { score: 60, ranges: [[0, q.length]] };
  const seg = id.indexOf('/' + q);
  if (seg >= 0) return { score: 60, ranges: [[seg + 1, seg + 1 + q.length]] };
  const at = id.indexOf(q);
  if (at >= 0) return { score: 40, ranges: [[at, at + q.length]] };
  if (q.length >= 3 && !q.includes('/')) {
    // Subsequence of the last segment: one range per run of matched characters.
    const ranges: Range[] = [];
    let i = 0;
    for (let j = 0; j < last.length && i < q.length; j++) {
      if (last[j] !== q[i]) continue;
      i++;
      const prev = ranges[ranges.length - 1];
      if (prev && prev[1] === start + j) prev[1]++;
      else ranges.push([start + j, start + j + 1]);
    }
    if (i === q.length) return { score: 20, ranges };
  }
  return null;
}

/** One index over ids and descriptions; build it once and query it many times. */
export function createSearch(ids: readonly string[], desc: readonly string[] = []): (query: string, limit?: number) => SearchResult {
  const idLower = ids.map((s) => s.toLowerCase());
  const descLower = desc.map((s) => s.toLowerCase());
  return (query, limit = 12) => {
    const q = query.trim().toLowerCase();
    if (!q) return { hits: [], total: 0 };
    const hits: SearchHit[] = [];
    for (let i = 0; i < idLower.length; i++) {
      const m = matchId(idLower[i], q);
      if (m) {
        hits.push({ index: i, score: m.score, field: 'id', ranges: m.ranges });
        continue;
      }
      const at = q.length >= 3 ? (descLower[i]?.indexOf(q) ?? -1) : -1;
      if (at >= 0) hits.push({ index: i, score: DESC_SCORE, field: 'desc', ranges: [[at, at + q.length]] });
    }
    hits.sort((a, b) => b.score - a.score || ids[a.index].length - ids[b.index].length || (ids[a.index] < ids[b.index] ? -1 : 1));
    return { hits: hits.slice(0, limit), total: hits.length };
  };
}
