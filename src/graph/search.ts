export interface SearchHit {
  index: number;
  score: number;
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
  return i === q.length;
}

/** Both arguments must already be lower-cased. */
export function scoreMatch(idLower: string, q: string): number {
  const last = idLower.slice(idLower.lastIndexOf('/') + 1);
  if (last === q || idLower === q) return 100;
  if (last.startsWith(q)) return 80;
  if (idLower.startsWith(q) || idLower.includes('/' + q)) return 60;
  if (idLower.includes(q)) return 40;
  if (q.length >= 3 && !q.includes('/') && isSubsequence(q, last)) return 20;
  return 0;
}

export function highlightRange(id: string, query: string): [number, number] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const at = id.toLowerCase().indexOf(q);
  return at < 0 ? null : [at, at + q.length];
}

export function createSearch(ids: string[]): (query: string, limit?: number) => SearchHit[] {
  const lower = ids.map((s) => s.toLowerCase());
  return (query, limit = 12) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (let i = 0; i < lower.length; i++) {
      const score = scoreMatch(lower[i], q);
      if (score > 0) hits.push({ index: i, score });
    }
    hits.sort(
      (a, b) =>
        b.score - a.score ||
        ids[a.index].length - ids[b.index].length ||
        (ids[a.index] < ids[b.index] ? -1 : 1),
    );
    return hits.slice(0, limit);
  };
}
