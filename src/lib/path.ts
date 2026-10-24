// Minimal path helpers that understand both "/" and "\" separators.

export const sep = (p: string) => (p.includes('\\') && !p.includes('/') ? '\\' : '/');

export function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i <= 0 ? p.slice(0, i + 1) : p.slice(0, i);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i + 1).toLowerCase() : '';
}

export function stem(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(0, i) : b;
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('\\\\');
}

export function join(base: string, rel: string): string {
  const s = sep(base);
  const parts = base.split(/[\\/]/);
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  const out = parts.join(s);
  return base.startsWith('/') && !out.startsWith('/') ? '/' + out : out;
}

export function relative(fromDir: string, to: string): string {
  const a = fromDir.split(/[\\/]/).filter(Boolean);
  const b = to.split(/[\\/]/).filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === 0) return to.replace(/\\/g, '/');
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

export type DocKind = 'markdown' | 'csv' | 'code' | 'text';

const MD_EXT = ['md', 'markdown', 'mdown', 'mkd', 'mdx'];
const PLAIN_EXT = ['txt', 'text', 'log', 'rst', 'adoc', 'asciidoc', 'org', 'srt', 'vtt'];

/** File extension (or well-known file name) → highlight.js language id. */
const CODE_LANG: Record<string, string> = {
  json: 'json', jsonc: 'json', json5: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini',
  properties: 'properties', env: 'bash', xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', vue: 'xml', svelte: 'xml',
  css: 'css', scss: 'scss', less: 'less', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  kts: 'kotlin', swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', php: 'php', pl: 'perl',
  lua: 'lua', r: 'r', sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', ps1: 'powershell', bat: 'dos',
  dart: 'dart', scala: 'scala', clj: 'clojure', ex: 'elixir', exs: 'elixir', erl: 'erlang', hs: 'haskell', ml: 'ocaml',
  diff: 'diff', patch: 'diff', gradle: 'gradle', cmake: 'cmake', dockerfile: 'dockerfile', tex: 'latex', bib: 'latex',
  makefile: 'makefile', gitignore: 'bash', editorconfig: 'ini', nim: 'nim', zig: 'zig',
};

const keyOf = (p: string) => extname(p) || basename(p).toLowerCase();

export function docKind(p: string | null): DocKind {
  if (!p) return 'markdown'; // untitled documents are Markdown
  const k = keyOf(p);
  if (MD_EXT.includes(k)) return 'markdown';
  if (k === 'csv' || k === 'tsv') return 'csv';
  if (CODE_LANG[k]) return 'code';
  return 'text';
}

export const codeLang = (p: string) => CODE_LANG[keyOf(p)] ?? '';
export const isMarkdown = (p: string | null) => docKind(p) === 'markdown';
/** Any non-Markdown text document (plain text, code, data). */
export const isPlainText = (p: string | null) => !!p && docKind(p) !== 'markdown';
/** Files DotMD opens (mirrors is_text_file in src-tauri/src/fs.rs). */
export const isTextPath = (p: string) =>
  docKind(p) !== 'text' || PLAIN_EXT.includes(keyOf(p)) || ['readme', 'license', 'licence', 'changelog', 'authors', 'contributing', 'notes', 'todo'].includes(keyOf(p));
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl+';
