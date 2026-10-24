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

export const isMarkdown = (p: string | null) => !!p && ['md', 'markdown', 'mdown', 'mkd'].includes(extname(p));
export const isPlainText = (p: string | null) => !!p && ['txt', 'text'].includes(extname(p));
export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl+';
