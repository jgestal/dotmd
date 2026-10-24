<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { app, settings, toast } from '../state.svelte';
  import { renderHtml, postProcess, frontMatterHtml, escapeHtml } from '../render';
  import { currentTheme } from '../appearance.svelte';
  import { dirname, isAbsolute, isMarkdown, join } from '../path';
  import { openPath, toggleTaskLine } from '../actions';
  import { t } from '../i18n';

  let { syncLine = 0 }: { syncLine?: number } = $props();

  let scroller: HTMLElement;
  let body: HTMLElement;
  let seq = 0;
  let lastPath: string | null = null;

  async function render(md: string, path: string | null) {
    const my = ++seq;
    const markdown = !path || isMarkdown(path);
    const html = markdown ? frontMatterHtml(md) + (await renderHtml(md)) : `<pre class="plain-text">${escapeHtml(md)}</pre>`;
    if (my !== seq) return;
    // Render off-DOM first so the visible document swaps in one step (no flicker on re-render).
    const next = document.createElement('div');
    next.innerHTML = html;
    await postProcess(next, { dir: path ? dirname(path) : null, theme: currentTheme() });
    if (my !== seq || !body) return;
    const keep = scroller.scrollTop;
    body.replaceChildren(...next.childNodes);
    if (path !== lastPath) {
      scroller.scrollTop = 0;
      lastPath = path;
    } else scroller.scrollTop = keep;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const md = app.content;
    const path = app.path;
    currentTheme(); // re-render diagrams when the theme changes
    clearTimeout(timer);
    const delay = md.length > 200_000 ? 300 : 90;
    timer = setTimeout(() => render(md, path), lastPath === path ? delay : 0);
  });

  /** Scrolls so the element generated from `line` sits at the top (split-mode sync, outline clicks). */
  function scrollToLine(line: number, smooth = false) {
    if (!body || line < 1) return;
    let best: HTMLElement | null = null;
    for (const el of body.querySelectorAll<HTMLElement>(':scope > [data-sourcepos]')) {
      const start = parseInt(el.dataset.sourcepos!, 10);
      if (start <= line) best = el;
      else break;
    }
    const top = best ? best.offsetTop - 24 : 0;
    scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }

  $effect(() => {
    if (app.mode === 'split') scrollToLine(syncLine);
  });
  $effect(() => {
    const r = app.reveal;
    if (r.n && app.mode === 'preview') scrollToLine(r.line, true);
  });

  async function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const copy = target.closest<HTMLButtonElement>('button.copy-code');
    if (copy) {
      const code = copy.parentElement?.querySelector('code')?.textContent ?? '';
      await navigator.clipboard.writeText(code);
      toast(t('toast.copied'), 1000);
      return;
    }
    const cb = target.closest<HTMLInputElement>('input[type=checkbox]');
    if (cb) {
      const li = cb.closest<HTMLElement>('[data-sourcepos]');
      if (li) toggleTaskLine(parseInt(li.dataset.sourcepos!, 10));
      return;
    }
    const a = target.closest<HTMLAnchorElement>('a[href]');
    if (!a) return;
    const href = a.getAttribute('href')!;
    e.preventDefault();
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      const el = body.querySelector(`[id="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      await openUrl(href);
    } else if (app.path) {
      const file = decodeURI(href.split('#')[0]);
      const abs = isAbsolute(file) ? file : join(dirname(app.path), file);
      await openPath(abs);
    }
  }
</script>

<div class="preview-scroll" bind:this={scroller}>
  <article
    class="markdown-body preview"
    class:justify={settings.justify}
    class:hyphenate={settings.hyphenate}
    bind:this={body}
    onclick={onClick}
    role="presentation"
  ></article>
</div>

<style>
  .preview-scroll { height: 100%; overflow-y: auto; overflow-x: hidden; }
  .preview { max-width: var(--doc-width); margin: 0 auto; padding: 36px 32px 30vh; user-select: text; -webkit-user-select: text; cursor: auto; }
  :global(.zen) .preview { padding-top: 12vh; }
  :global(.markdown-body pre.has-copy .copy-code) {
    position: absolute; top: 6px; right: 6px; font: 11px var(--font-ui); color: var(--fg-muted);
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; opacity: 0.0;
    transition: opacity 0.15s; cursor: pointer;
  }
  :global(.markdown-body pre.has-copy:hover .copy-code) { opacity: 1; }
  :global(.markdown-body pre.has-copy .copy-code:hover::after) { content: ' ⧉'; }
</style>
