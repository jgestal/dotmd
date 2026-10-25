import { invoke } from '@tauri-apps/api/core';
import documentCss from './styles/document.css?raw';
import { postProcess, renderDocument, escapeHtml } from './render';
import { THEMES, type Theme } from './themes';
import { dirname, stem } from './path';
import { settings } from './state.svelte';
import { cssVars, fontsFor } from './appearance.svelte';
import { paginate, PAPER_MM } from './paginate';

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

/** For paginated PDFs: one sheet per printed page, margins already inside each sheet. */
function pagedCss(o: ExportOptions): string {
  const [w, h] = PAPER_MM[o.pageSize] ?? PAPER_MM.A4;
  return `@page{size:${w}mm ${h}mm;margin:0}
:root{--page-w:${w}mm;--page-h:${h}mm;--page-m:${o.margin}mm}
main.markdown-body.paged{max-width:none;margin:0;padding:0}
.paged .page{margin:0;box-shadow:none;border-radius:0;overflow:hidden;height:calc(${h}mm - 0.3mm);break-after:page;page-break-after:always}
.paged .page:last-child{break-after:auto;page-break-after:auto}`;
}

function printCss(o: ExportOptions): string {
  return `@page{size:${o.pageSize};margin:${o.margin}mm}
html,body{background:var(--bg);color:var(--fg);margin:0}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
main.markdown-body{max-width:var(--doc-width);margin:0 auto;padding:40px 24px}
@media print{main.markdown-body{max-width:none;padding:0}}
.doc-break{break-after:page}
.markdown-body table{display:table;width:auto;max-width:100%;overflow:visible}
.markdown-body thead{display:table-header-group}
.markdown-body tr{break-inside:avoid}
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
  host.innerHTML = await renderDocument(md, path);
  document.body.appendChild(host);
  try {
    await postProcess(host, { dir: path ? dirname(path) : null, theme, forExport: true });
  } finally {
    host.remove();
  }
  for (const el of host.querySelectorAll('[data-sourcepos]')) el.removeAttribute('data-sourcepos');
  return host;
}

/** Inline styles for rich-text pastes: mail clients and Google Docs ignore <style> blocks. */
const RICH_STYLE: Record<string, string> = {
  table: 'border-collapse:collapse;margin:8px 0',
  th: 'border:1px solid #d0d7de;padding:4px 10px;background:#f6f8fa;text-align:left',
  td: 'border:1px solid #d0d7de;padding:4px 10px',
  pre: 'background:#f6f8fa;padding:10px 12px;border-radius:6px;font-family:Menlo,Consolas,monospace;font-size:13px;white-space:pre-wrap',
  code: 'font-family:Menlo,Consolas,monospace;font-size:90%;background:#f3f3f6;padding:1px 4px;border-radius:4px',
  blockquote: 'margin:8px 0;padding:2px 12px;border-left:4px solid #d0d7de;color:#57606a',
  mark: 'background:#fff3a3',
  img: 'max-width:100%',
};

/** The document (or a Markdown snippet) as self-contained HTML with inline styles, for the clipboard. */
export async function richHtml(md: string, path: string | null, theme: Theme): Promise<string> {
  const frag = await renderFragment(md, path, theme);
  frag.querySelectorAll('a.anchor, .copy-code, .front-matter').forEach((el) => el.remove());
  for (const [tag, style] of Object.entries(RICH_STYLE)) {
    frag.querySelectorAll<HTMLElement>(tag).forEach((el) => {
      if (tag === 'code' && el.parentElement?.tagName === 'PRE') return;
      el.setAttribute('style', style);
    });
  }
  frag.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));
  return `<div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1f2328">${frag.innerHTML}</div>`;
}

/**
 * Lays a rendered fragment out on page sheets exactly as page view does (tables split with repeated
 * headers, headings kept with their text, page numbers). Print engines such as WebKit cannot repeat
 * table headers, so PDFs are made from these sheets: what page view shows is what gets printed.
 */
function paginateFragment(frag: HTMLElement, o: ExportOptions): string {
  const [w, h] = PAPER_MM[o.pageSize] ?? PAPER_MM.A4;
  const staging = document.createElement('div');
  staging.className = `markdown-body paged theme-${o.theme.kind}`;
  for (const [k, v] of Object.entries(cssVars(o.theme))) staging.style.setProperty(k, v);
  staging.style.setProperty('--page-w', `${w}mm`);
  staging.style.setProperty('--page-h', `${h}mm`);
  staging.style.setProperty('--page-m', `${o.margin}mm`);
  staging.style.cssText += ';position:fixed;left:-20000px;top:0;visibility:hidden';
  document.body.appendChild(staging);
  try {
    paginate(staging, [...frag.childNodes]);
    return staging.innerHTML;
  } finally {
    staging.remove();
  }
}

export async function buildDocument(docs: { md: string; path: string | null }[], o: ExportOptions, title: string, paged = false): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < docs.length; i++) {
    const frag = await renderFragment(docs[i].md, docs[i].path, o.theme);
    const toc = o.toc ? tocHtml(frag) : '';
    if (paged) {
      if (toc) frag.insertAdjacentHTML('afterbegin', toc);
      parts.push(paginateFragment(frag, o));
    } else {
      parts.push(`<section class="${i < docs.length - 1 ? 'doc-break' : ''}">${toc}${frag.innerHTML}</section>`);
    }
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
${printCss(o)}
${paged ? pagedCss(o) : ''}</style>
</head>
<body>
<main class="markdown-body theme-${o.theme.kind}${paged ? ' paged' : ''}">
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
  const html = await buildDocument(docs, o, docs.length === 1 && docs[0].path ? stem(docs[0].path) : stem(out), true);
  // System WebKit first (macOS), so no browser is needed; Chromium headless otherwise.
  if (settings.pdfEngine !== 'chromium') {
    try {
      // Margins live inside the paginated sheets, so the print operation itself uses none.
      await invoke('export_pdf_native', { html, out, pageSize: o.pageSize, marginMm: 0 });
      return true;
    } catch (e) {
      if (String(e) !== 'unsupported') console.warn('Native PDF export failed, trying Chromium:', e);
    }
  }
  try {
    await invoke('export_pdf', { html, out });
    return true;
  } catch (e) {
    if (String(e) === 'no-engine') return false;
    throw e;
  }
}
