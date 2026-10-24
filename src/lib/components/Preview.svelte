<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { app, settings, toast } from '../state.svelte';
  import { renderHtml, postProcess, frontMatterHtml, escapeHtml } from '../render';
  import { currentTheme } from '../appearance.svelte';
  import { dirname, isAbsolute, isMarkdown, join } from '../path';
  import { openPath, toggleTaskLine } from '../actions';
  import { t } from '../i18n';

  let { syncLine = 0, onScrollLine }: { syncLine?: number; onScrollLine?: (line: number) => void } = $props();

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
    if (pendingReveal) {
      scrollToLine(pendingReveal, true);
      pendingReveal = 0;
    }
  }

  /** A reveal requested before the document finished rendering (search result in another file). */
  let pendingReveal = 0;

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const md = app.content;
    const path = app.path;
    currentTheme(); // re-render diagrams when the theme changes
    clearTimeout(timer);
    const delay = md.length > 200_000 ? 300 : 90;
    timer = setTimeout(() => render(md, path), lastPath === path ? delay : 0);
  });

  /** Top-level blocks with their source line range and position inside the scroller. */
  function blocks() {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    return [...body.querySelectorAll<HTMLElement>(':scope > [data-sourcepos]')].map((el) => {
      const m = el.dataset.sourcepos!.match(/^(\d+):\d+-(\d+):/);
      const r = el.getBoundingClientRect();
      return { start: Number(m?.[1] ?? 0), end: Number(m?.[2] ?? m?.[1] ?? 0), top: r.top - base, height: r.height };
    });
  }

  /** Ignore our own scroll events right after a programmatic scroll, so the two panes don't ping-pong. */
  let quietUntil = 0;

  /** Scrolls so source `line` sits at the top, interpolating inside long blocks (split sync, outline clicks). */
  function scrollToLine(line: number, smooth = false) {
    if (!body || line < 1) return;
    let top = 0;
    for (const b of blocks()) {
      if (b.start > line) break;
      const span = Math.max(1, b.end - b.start + 1);
      top = b.top + Math.min(1, (line - b.start) / span) * b.height;
    }
    quietUntil = performance.now() + 200;
    scroller.scrollTo({ top: Math.max(0, top - 24), behavior: smooth ? 'smooth' : 'auto' });
  }

  function onScroll() {
    if (!onScrollLine || performance.now() < quietUntil || !body) return;
    const y = scroller.scrollTop + 24;
    let line = 1;
    for (const b of blocks()) {
      if (b.top > y) break;
      const span = Math.max(1, b.end - b.start + 1);
      line = b.start + Math.floor(Math.min(1, (y - b.top) / Math.max(1, b.height)) * span);
    }
    onScrollLine(line);
  }

  $effect(() => {
    if (app.mode === 'split') scrollToLine(syncLine);
  });
  $effect(() => {
    const r = app.reveal;
    if (r.n && app.mode === 'preview') {
      pendingReveal = r.line;
      scrollToLine(r.line, true);
    }
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

<div class="preview-scroll" bind:this={scroller} onscroll={onScroll}>
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
