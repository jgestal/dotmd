export interface Stats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  letters: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  headings: number;
  links: number;
  images: number;
  syllables: number;
  readability: number | null;
}

/** Strips Markdown syntax so counts reflect the prose a reader actually sees. */
export function toPlain(md: string): string {
  return md
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\^[^\]]+\]:?/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?(\[!\w+\])?/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__|~~|==|`)/g, '')
    .replace(/(^|\s)[*_](\S)/g, '$1$2')
    .replace(/(\S)[*_](\s|$)/g, '$1$2')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '');
}

const wordSeg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
const sentSeg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'sentence' }) : null;

export function countWords(text: string): number {
  if (!wordSeg) return (text.match(/[\p{L}\p{N}]+(['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
  let n = 0;
  for (const s of wordSeg.segment(text)) if (s.isWordLike) n++;
  return n;
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-záéíóúüñàèìòùâêîôûäëïöÿ]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouyáéíóúüàèìòùâêîôûäëïöÿ]+/g);
  let n = groups ? groups.length : 1;
  if (w.length > 3 && w.endsWith('e') && !w.endsWith('le')) n = Math.max(1, n - 1);
  return Math.max(1, n);
}

export function computeStats(raw: string, markdown: boolean, lang: string): Stats {
  const plain = markdown ? toPlain(raw) : raw;
  const words = countWords(plain);
  const chars = [...plain.replace(/\n+$/, '')].length;
  const charsNoSpaces = [...plain.replace(/\s/g, '')].length;
  const letters = (plain.match(/\p{L}/gu) ?? []).length;
  let sentences = 0;
  if (sentSeg) {
    for (const s of sentSeg.segment(plain)) if (/[\p{L}\p{N}]/u.test(s.segment)) sentences++;
  } else sentences = (plain.match(/[^.!?…]+[.!?…]+/g) ?? []).length;
  const paragraphs = raw.split(/\n\s*\n/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
  const lines = raw === '' ? 0 : raw.split('\n').length;
  const headings = markdown ? (raw.match(/^\s{0,3}#{1,6}\s/gm) ?? []).length : 0;
  const links = markdown ? (raw.match(/(?<!!)\[[^\]]*\]\([^)]*\)/g) ?? []).length : 0;
  const images = markdown ? (raw.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length : 0;

  // Syllable-based readability is only worth it below ~200k chars; it is an estimate anyway.
  let syllables = 0;
  let readability: number | null = null;
  if (words > 30 && plain.length < 200_000) {
    for (const w of plain.match(/\p{L}+/gu) ?? []) syllables += countSyllables(w);
    const s = Math.max(1, sentences);
    readability = lang === 'es'
      ? 206.84 - 0.6 * (syllables / words) * 100 - 1.02 * (s / words) * 100 // Fernández-Huerta
      : 206.835 - 1.015 * (words / s) - 84.6 * (syllables / words); // Flesch reading ease
    readability = Math.max(0, Math.min(100, Math.round(readability)));
  }
  return { words, chars, charsNoSpaces, letters, sentences, paragraphs, lines, headings, links, images, syllables, readability };
}

/** Guesses whether a document is Spanish, for picking the readability formula. */
export function guessLang(text: string, fallback: string): string {
  const sample = text.slice(0, 4000).toLowerCase();
  const es = (sample.match(/\b(el|la|los|las|que|de|y|en|un|una|por|para|con|es|del)\b/g) ?? []).length;
  const en = (sample.match(/\b(the|and|of|to|is|in|that|it|for|with|on|this|are)\b/g) ?? []).length;
  if (es + en < 8) return fallback;
  return es > en ? 'es' : 'en';
}

export function formatMinutes(words: number, wpm: number): string {
  const m = words / Math.max(60, wpm);
  if (m < 1) return '<1';
  return Math.round(m).toString();
}
