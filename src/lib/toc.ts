// Table of contents inside the document, between <!-- toc --> and <!-- tocstop --> markers (the
// convention of VS Code's Markdown All in One and markdown-toc), inserted at the top or refreshed.

const START = '<!-- toc -->';
const END = '<!-- tocstop -->';

/** GitHub-style heading anchor, as comrak generates it (lowercase, punctuation dropped, spaces → -). */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

interface Heading { level: number; text: string }

function headings(md: string): Heading[] {
  const out: Heading[] = [];
  let fence = false, inToc = false, front = md.startsWith('---\n');
  for (const [i, line] of md.split('\n').entries()) {
    if (front) { if (i > 0 && line.trim() === '---') front = false; continue; }
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence) continue;
    if (line.includes(START)) inToc = true;
    if (line.includes(END)) { inToc = false; continue; }
    if (inToc) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1].length, text: m[2] });
  }
  return out;
}

/** The Markdown list for a document's headings (the title H1 is left out when there is only one). */
export function tocList(md: string, maxDepth = 3): string {
  const hs = headings(md);
  const h1s = hs.filter((h) => h.level === 1).length;
  const items = h1s === 1 ? hs.filter((h) => h.level > 1) : hs;
  if (!items.length) return '';
  const top = Math.min(...items.map((h) => h.level));
  const seen = new Map<string, number>();
  return items
    .filter((h) => h.level - top < maxDepth)
    .map((h) => {
      const plain = h.text.replace(/[*_`~]|\[([^\]]*)\]\([^)]*\)/g, (_m, link) => link ?? '');
      let s = slug(plain);
      const n = seen.get(s) ?? 0;
      seen.set(s, n + 1);
      if (n) s = `${s}-${n}`;
      return `${'  '.repeat(h.level - top)}- [${plain}](#${s})`;
    })
    .join('\n');
}

export const hasToc = (md: string) => md.includes(START) && md.includes(END);

/** Refreshes the TOC block, or inserts one after the front matter and the title heading. */
export function applyToc(md: string): string {
  const block = `${START}\n${tocList(md)}\n${END}`;
  if (hasToc(md)) {
    const a = md.indexOf(START), b = md.indexOf(END, a) + END.length;
    return md.slice(0, a) + block + md.slice(b);
  }
  const lines = md.split('\n');
  let at = 0;
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1);
    if (close > 0) at = close + 1;
  }
  while (at < lines.length && !lines[at].trim()) at++;
  if (/^#\s/.test(lines[at] ?? '')) {
    at++;
    // Keep an intro paragraph right under the title above the TOC.
    while (at < lines.length && !lines[at].trim()) at++;
  }
  const before = lines.slice(0, at).join('\n').replace(/\n+$/, '');
  const after = lines.slice(at).join('\n').replace(/^\n+/, '');
  return [before, block, after].filter(Boolean).join('\n\n') + (md.endsWith('\n') && !after.endsWith('\n') ? '\n' : '');
}
