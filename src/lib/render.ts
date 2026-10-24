import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import katex from 'katex';
import { isAbsolute, join } from './path';
import type { Theme } from './themes';

export async function renderHtml(md: string): Promise<string> {
  const raw = await invoke<string>('render_markdown', { text: md });
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'script'] });
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** YAML front matter rendered as a small key/value card. */
export function frontMatterHtml(md: string): string {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return '';
  const rows = m[1]
    .split(/\r?\n/)
    .map((l) => l.match(/^([\w-]+):\s*(.*)$/))
    .filter(Boolean)
    .map((r) => `<tr><th>${escapeHtml(r![1])}</th><td>${escapeHtml(r![2].replace(/^["']|["']$/g, ''))}</td></tr>`)
    .join('');
  return rows ? `<table class="front-matter">${rows}</table>` : '';
}

let mermaidMod: typeof import('mermaid').default | null = null;
let mermaidKey = '';
const mermaidCache = new Map<string, string>();
let mermaidSeq = 0;

function mermaidConfig(theme: Theme) {
  const v = theme.vars;
  return {
    startOnLoad: false,
    securityLevel: 'strict' as const,
    theme: 'base' as const,
    fontFamily: theme.fonts.doc,
    themeVariables: {
      darkMode: theme.dark,
      background: v['--bg'],
      primaryColor: v['--code-bg'],
      primaryTextColor: v['--fg'],
      primaryBorderColor: v['--accent'],
      secondaryColor: v['--bg-elev'],
      tertiaryColor: v['--bg-elev'],
      lineColor: v['--fg-muted'],
      textColor: v['--fg'],
      mainBkg: v['--code-bg'],
      nodeBorder: v['--accent'],
      clusterBkg: v['--bg-elev'],
      titleColor: v['--fg'],
      edgeLabelBackground: v['--bg'],
      fontFamily: theme.fonts.doc,
    },
  };
}

async function renderMermaid(code: string, theme: Theme): Promise<string> {
  const key = theme.id + '\u0000' + code;
  const hit = mermaidCache.get(key);
  if (hit) return hit;
  if (!mermaidMod) mermaidMod = (await import('mermaid')).default;
  if (mermaidKey !== theme.id) {
    mermaidMod.initialize(mermaidConfig(theme));
    mermaidKey = theme.id;
  }
  const { svg } = await mermaidMod.render(`mdv-mermaid-${++mermaidSeq}`, code);
  if (mermaidCache.size > 200) mermaidCache.clear();
  mermaidCache.set(key, svg);
  return svg;
}

export async function mermaidSvg(code: string, theme: Theme): Promise<string> {
  try {
    return await renderMermaid(code, theme);
  } catch (e) {
    return `<div class="mermaid-error">Mermaid: ${escapeHtml(String((e as Error)?.message ?? e))}</div>`;
  }
}

export interface PostOptions {
  dir: string | null;
  theme: Theme;
  forExport?: boolean;
}

function resolveSrc(src: string, dir: string | null): string | null {
  if (!src || /^(https?:|data:|blob:|asset:|tauri:|mailto:|#)/i.test(src)) return null;
  let p = decodeURI(src.split('#')[0].split('?')[0]);
  if (p.startsWith('file://')) p = p.slice(7);
  if (!isAbsolute(p)) {
    if (!dir) return null;
    p = join(dir, p);
  }
  return p;
}

/** Turns the raw HTML from comrak into the final document: images, code, math, diagrams. */
export async function postProcess(root: HTMLElement, opts: PostOptions): Promise<void> {
  const jobs: Promise<unknown>[] = [];

  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    const abs = resolveSrc(img.getAttribute('src') ?? '', opts.dir);
    if (!abs) continue;
    if (opts.forExport) {
      jobs.push(invoke<string>('read_data_url', { path: abs }).then((d) => (img.src = d)).catch(() => {}));
    } else {
      img.src = convertFileSrc(abs);
    }
    img.loading = 'lazy';
  }

  for (const el of root.querySelectorAll<HTMLElement>('[data-math-style]')) {
    try {
      katex.render(el.textContent ?? '', el, {
        displayMode: el.dataset.mathStyle === 'display',
        throwOnError: false,
        output: opts.forExport ? 'mathml' : 'htmlAndMathml',
      });
      el.classList.add('math-rendered');
      if (el.parentElement?.tagName === 'PRE') el.parentElement.replaceWith(el);
    } catch {}
  }

  for (const code of root.querySelectorAll<HTMLElement>('pre > code')) {
    if (code.dataset.mathStyle) continue;
    const pre = code.parentElement!;
    const lang = (code.className.match(/language-([\w+#-]+)/)?.[1] ?? '').toLowerCase();
    if (lang === 'mermaid') {
      const src = code.textContent ?? '';
      const holder = document.createElement('div');
      holder.className = 'mermaid-diagram';
      for (const a of ['data-sourcepos']) if (pre.hasAttribute(a)) holder.setAttribute(a, pre.getAttribute(a)!);
      pre.replaceWith(holder);
      jobs.push(mermaidSvg(src, opts.theme).then((svg) => (holder.innerHTML = svg)));
      continue;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        code.innerHTML = hljs.highlight(code.textContent ?? '', { language: lang, ignoreIllegals: true }).value;
        code.classList.add('hljs');
      } catch {}
    }
    if (!opts.forExport) {
      pre.classList.add('has-copy');
      const btn = document.createElement('button');
      btn.className = 'copy-code';
      btn.type = 'button';
      btn.textContent = lang || 'copy';
      btn.dataset.lang = lang;
      pre.appendChild(btn);
    }
  }

  for (const cb of root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
    if (!opts.forExport) cb.removeAttribute('disabled');
    else {
      // Form controls print inconsistently (WebKit draws them as dots): use glyphs in exports.
      const box = document.createElement('span');
      box.className = 'task-box';
      box.textContent = cb.checked || cb.hasAttribute('checked') ? '☑' : '☐';
      cb.replaceWith(box);
    }
  }
  await Promise.all(jobs);
}
