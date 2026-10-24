/**
 * Subsequence fuzzy match. Returns null when `query` does not match, otherwise a score
 * (higher is better) and the matched character indices for highlighting.
 * Consecutive runs, word starts and matches near the start score higher.
 */
export function fuzzyMatch(query: string, text: string): { score: number; indices: number[] } | null {
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return { score: 0, indices: [] };
  const s = text.toLowerCase();
  const indices: number[] = [];
  let score = 0, prev = -2, qi = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] !== q[qi]) continue;
    const wordStart = i === 0 || /[\s/\\._:-]/.test(s[i - 1]);
    score += 1 + (prev === i - 1 ? 5 : 0) + (wordStart ? 3 : 0) - Math.min(i, 30) * 0.02;
    indices.push(i);
    prev = i;
    qi++;
  }
  if (qi < q.length) return null;
  return { score: score - s.length * 0.01, indices };
}

/** Wraps matched characters in <mark> (input is escaped). */
export function highlight(text: string, indices: number[]): string {
  const set = new Set(indices);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i].replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
    out += set.has(i) ? `<mark>${c}</mark>` : c;
  }
  return out;
}
