import { invoke } from '@tauri-apps/api/core';
import documentCss from './styles/document.css?raw';
import { renderHtml, postProcess, frontMatterHtml, escapeHtml } from './render';
import { THEMES, type Theme } from './themes';
import { dirname, isMarkdown, stem } from './path';
import { settings } from './state.svelte';
import { cssVars, fontsFor } from './appearance.svelte';

export interface ExportOptions {
  theme: Theme;
  pageSize: string;
  margin: number;
  toc: boolean;
}

export function exportTheme(current: Theme): Theme {
  if (settings.exportTheme === 'current') return current;
  return THEMES.find((t) => t.id === settings.exportTheme) ?? current;
}

function themeCss(theme: Theme): string {
  return ':root{' + Object.entries(cssVars(theme)).map(([k, v]) => `${k}:${v};`).join('') + '}';
}

const fontCache = new Map<string, Promise<string>>();

function dataUrl(url: string): Promise<string> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.blob())
      .then((b) => new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(b);
      }));
    fontCache.set(url, p);
  }
  return p;
}

/** True if a CSS unicode-range covers basic Latin or Latin Extended (other scripts fall back to system fonts). */
export function coversLatin(range: string): boolean {
  if (!range.trim()) return true;
  return range.split(',').some((part) => {
    const m = part.trim().match(/^U\+([0-9A-F?]+)(?:-([0-9A-F]+))?$/i);
    if (!m) return false;
    const lo = parseInt(m[1].replace(/\?/g, '0'), 16);
    const hi = m[2] ? parseInt(m[2], 16) : parseInt(m[1].replace(/\?/g, 'F'), 16);
    return (lo <= 0x41 && hi >= 0x41) || (lo <= 0x101 && hi >= 0x101);
  });
}

/**
 * @font-face rules for the fonts the export theme uses, with the files inlined as data: URLs,
 * so a typewriter or CRT export looks the same on a machine without those fonts.
 */
async function embeddedFonts(theme: Theme): Promise<string> {
  const f = fontsFor(theme);
  const families = new Set(
    [f.doc, f.heading, f.code].flatMap((stack) => [...stack.matchAll(/"([^"]+)"|^\s*([A-Za-z0-9 ]+?)\s*(?:,|$)/g)].map((m) => (m[1] ?? m[2]).trim())),
  );
  const out: string[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of [...rules]) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const st = rule.style;
      const family = st.getPropertyValue('font-family').replace(/["']/g, '').trim();
      if (!families.has(family)) continue;
      const range = st.getPropertyValue('unicode-range');
      if (!coversLatin(range)) continue;
      const url = st.getPropertyValue('src').match(/url\(["']?([^"')]+\.woff2[^"')]*)["']?\)/)?.[1];
      if (!url) continue;
      try {
        const data = await dataUrl(new URL(url, sheet.href ?? location.href).href);
        out.push(`@font-face{font-family:"${family}";font-style:${st.getPropertyValue('font-style') || 'normal'};` +
          `font-weight:${st.getPropertyValue('font-weight') || '400'};font-display:swap;src:url(${data}) format("woff2");` +
          (range ? `unicode-range:${range};` : '') + '}');
      } catch {}
    }
  }
  return out.join('\n');
}

function printCss(o: ExportOptions): string {
  return `@page{size:${o.pageSize};margin:${o.margin}mm}
html,body{background:var(--bg);color:var(--fg);margin:0}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
main.markdown-body{max-width:var(--doc-width);margin:0 auto;padding:40px 24px}
@media print{main.markdown-body{max-width:none;padding:0}}
.doc-break{break-after:page}
.mdv-toc{border-bottom:1px solid var(--border);margin-bottom:2em;padding-bottom:1em}
.mdv-toc ol{list-style:none;padding-left:1em}.mdv-toc>ol{padding-left:0}
.mdv-toc a{color:var(--fg);text-decoration:none}`;
}

function tocHtml(root: HTMLElement): string {
  const hs = [...root.querySelectorAll<HTMLElement>('h1, h2, h3')];
  if (hs.length < 2) return '';
  const items = hs.map((h) => {
    const id = h.querySelector('a.anchor')?.id || h.id;
    const level = Number(h.tagName[1]);
    return `<li style="margin-left:${(level - 1) * 1.2}em"><a href="#${escapeHtml(id)}">${escapeHtml(h.textContent ?? '')}</a></li>`;
  });
  return `<nav class="mdv-toc"><ol>${items.join('')}</ol></nav>`;
}

/** Renders one document into a static fragment (no scripts) inside a hidden container. */
async function renderFragment(md: string, path: string | null, theme: Theme): Promise<HTMLElement> {
  const host = document.createElement('div');
  host.className = 'markdown-body export-staging';
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:800px;visibility:hidden';
  const body = !path || isMarkdown(path) ? await renderHtml(md) : `<pre class="plain-text">${escapeHtml(md)}</pre>`;
  host.innerHTML = frontMatterHtml(md) + body;
  document.body.appendChild(host);
  try {
    await postProcess(host, { dir: path ? dirname(path) : null, theme, forExport: true });
  } finally {
    host.remove();
  }
  for (const el of host.querySelectorAll('[data-sourcepos]')) el.removeAttribute('data-sourcepos');
  return host;
}

export async function buildDocument(docs: { md: string; path: string | null }[], o: ExportOptions, title: string): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < docs.length; i++) {
    const frag = await renderFragment(docs[i].md, docs[i].path, o.theme);
    const toc = o.toc ? tocHtml(frag) : '';
    parts.push(`<section class="${i < docs.length - 1 ? 'doc-break' : ''}">${toc}${frag.innerHTML}</section>`);
  }
  return `<!doctype html>
<html lang="${settings.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="DotMD">
<title>${escapeHtml(title)}</title>
<style>${settings.exportEmbedFonts ? await embeddedFonts(o.theme) : ''}
${themeCss(o.theme)}
${documentCss}
${printCss(o)}</style>
</head>
<body>
<main class="markdown-body theme-${o.theme.kind}">
${parts.join('\n')}
</main>
</body>
</html>`;
}

export async function exportHtmlFile(docs: { md: string; path: string | null }[], out: string, o: ExportOptions) {
  const html = await buildDocument(docs, o, docs.length === 1 && docs[0].path ? stem(docs[0].path) : stem(out));
  await invoke('write_export', { path: out, html });
}

/** Returns false when no PDF engine is available (caller falls back to the print dialog). */
export async function exportPdfFile(docs: { md: string; path: string | null }[], out: string, o: ExportOptions): Promise<boolean> {
  const html = await buildDocument(docs, o, docs.length === 1 && docs[0].path ? stem(docs[0].path) : stem(out));
  try {
    await invoke('export_pdf', { html, out });
    return true;
  } catch (e) {
    if (String(e) === 'no-engine') return false;
    throw e;
  }
}
