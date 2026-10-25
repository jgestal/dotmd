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
    const asl = words / s; // words per sentence
    const asw = syllables / words; // syllables per word
    readability = (READABILITY[lang] ?? READABILITY.en)(asl, asw);
    readability = Math.max(0, Math.min(100, Math.round(readability)));
  }
  return { words, chars, charsNoSpaces, letters, sentences, paragraphs, lines, headings, links, images, syllables, readability };
}

/** Flesch reading ease adapted to each language (0 = very hard, 100 = very easy). */
const READABILITY: Record<string, (asl: number, asw: number) => number> = {
  en: (asl, asw) => 206.835 - 1.015 * asl - 84.6 * asw, // Flesch
  es: (asl, asw) => 206.84 - 60 * asw - 102 / asl, // Fernández-Huerta
  ca: (asl, asw) => 206.84 - 60 * asw - 102 / asl, // Fernández-Huerta (close Romance syllable structure)
  gl: (asl, asw) => 206.84 - 60 * asw - 102 / asl,
  fr: (asl, asw) => 207 - 1.015 * asl - 73.6 * asw, // Kandel & Moles
  de: (asl, asw) => 180 - asl - 58.5 * asw, // Amstad
  it: (asl, asw) => 217 - 1.3 * asl - 60 * asw, // Flesch–Vacca
  pt: (asl, asw) => 248.835 - 1.015 * asl - 84.6 * asw, // Martins et al.
};

// Frequent words that are typical of each language (overlaps kept small on purpose).
const MARKERS: Record<string, string[]> = {
  en: ['the', 'and', 'of', 'to', 'is', 'that', 'it', 'for', 'with', 'this', 'are', 'was'],
  es: ['el', 'los', 'las', 'y', 'por', 'del', 'para', 'con', 'es', 'está', 'pero', 'muy'],
  fr: ['le', 'les', 'des', 'est', 'et', 'une', 'qui', 'pas', 'dans', 'pour', 'sur', 'avec'],
  de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'ein', 'eine', 'mit', 'von', 'sich', 'auch'],
  it: ['il', 'gli', 'della', 'delle', 'sono', 'anche', 'questo', 'è', 'nel', 'alla', 'perché', 'molto'],
  pt: ['não', 'uma', 'os', 'também', 'são', 'você', 'em', 'mais', 'pelo', 'muito', 'isso', 'até'],
  ca: ['els', 'amb', 'és', 'i', 'això', 'perquè', 'dels', 'aquest', 'molt', 'però', 'fins', 'seu'],
  gl: ['unha', 'non', 'tamén', 'xa', 'ao', 'polo', 'coma', 'moi', 'iso', 'aínda', 'nin', 'cando'],
};

/** Guesses the language of a document (for the readability formula); `fallback` if unsure. */
export function guessLang(text: string, fallback: string): string {
  const words = text.slice(0, 4000).toLowerCase().match(/\p{L}+/gu) ?? [];
  const counts = new Map<string, number>();
  const index = new Map<string, string[]>();
  for (const [lang, list] of Object.entries(MARKERS)) for (const w of list) index.set(w, [...(index.get(w) ?? []), lang]);
  for (const w of words) for (const lang of index.get(w) ?? []) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < 3 || ranked[0][1] === ranked[1]?.[1]) return fallback;
  return ranked[0][0];
}

export function formatMinutes(words: number, wpm: number): string {
  const m = words / Math.max(60, wpm);
  if (m < 1) return '<1';
  return Math.round(m).toString();
}
