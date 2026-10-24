import { invoke } from '@tauri-apps/api/core';
import documentCss from './styles/document.css?raw';
import { renderHtml, postProcess, frontMatterHtml, escapeHtml } from './render';
import { THEMES, type Theme } from './themes';
import { dirname, isMarkdown, stem } from './path';
import { settings } from './state.svelte';
import { cssVars } from './appearance.svelte';

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
<style>${themeCss(o.theme)}
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
