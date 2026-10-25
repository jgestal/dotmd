<script lang="ts">
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { app, settings, toast } from '../state.svelte';
  import { postProcess, renderDocument } from '../render';
  import { paginate, PAPER_MM } from '../paginate';
  import { currentTheme } from '../appearance.svelte';
  import { dirname, isAbsolute, join } from '../path';
  import { openPath, toggleTaskLine } from '../actions';
  import { t } from '../i18n';

  let { syncLine = 0, onScrollLine }: { syncLine?: number; onScrollLine?: (line: number) => void } = $props();

  let scroller: HTMLElement;
  let body: HTMLElement;
  let seq = 0;
  let lastPath: string | null = null;

  async function render(md: string, path: string | null) {
    const my = ++seq;
    const html = await renderDocument(md, path);
    if (my !== seq) return;
    // Render off-DOM first so the visible document swaps in one step (no flicker on re-render).
    const next = document.createElement('div');
    next.innerHTML = html;
    await postProcess(next, { dir: path ? dirname(path) : null, theme: currentTheme() });
    if (paged) {
      // Pagination measures heights, so images must be decoded before blocks are placed.
      const imgs = [...next.querySelectorAll('img')];
      imgs.forEach((i) => (i.loading = 'eager'));
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
    }
    if (my !== seq || !body) return;
    const keep = scroller.scrollTop;
    if (paged) {
      body.replaceChildren();
      const t0 = performance.now();
      app.pageCount = paginate(body, [...next.childNodes]);
      app.paginateMs = performance.now() - t0;
      fitPages();
    } else {
      app.pageCount = 0;
      body.replaceChildren(...next.childNodes);
    }
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

  /** Page view: sheets with the export paper size and margins (Read and Split modes). */
  const paged = $derived(settings.pageView);
  const paper = $derived(PAPER_MM[settings.pdfPageSize] ?? PAPER_MM.A4);

  /** Scales the sheets down when the pane is narrower than the paper. */
  function fitPages() {
    if (!body || !scroller) return;
    const pagePx = (paper[0] / 25.4) * 96;
    body.style.zoom = paged ? String(Math.min(1, (scroller.clientWidth - 48) / pagePx)) : '';
  }

  $effect(() => {
    if (!scroller) return;
    const ro = new ResizeObserver(() => fitPages());
    ro.observe(scroller);
    return () => ro.disconnect();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const md = app.content;
    const path = app.path;
    paged; paper; settings.pdfMargin; // re-layout when page settings change
    currentTheme(); // re-render diagrams when the theme changes
    clearTimeout(timer);
    // Long documents re-render less often while typing (page view re-lays out every sheet).
    const delay = md.length > 200_000 ? 300 : paged && md.length > 30_000 ? 350 : 90;
    timer = setTimeout(() => render(md, path), lastPath === path ? delay : 0);
  });

  /** Top-level blocks with their source line range and position inside the scroller. */
  function blocks() {
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    return [...body.querySelectorAll<HTMLElement>(':scope > [data-sourcepos], :scope > .page > .page-inner > [data-sourcepos]')].map((el) => {
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
    if (!body) return;
    if (!onScrollLine) {
      if (app.mode === 'preview') app.viewLine = topLine();
      return;
    }
    if (performance.now() < quietUntil) return;
    const y = scroller.scrollTop + 24;
    let line = 1;
    for (const b of blocks()) {
      if (b.top > y) break;
      const span = Math.max(1, b.end - b.start + 1);
      line = b.start + Math.floor(Math.min(1, (y - b.top) / Math.max(1, b.height)) * span);
    }
    onScrollLine(line);
  }

  /** Source line at the top of the viewport (outline highlight in Read mode). */
  function topLine(): number {
    const y = scroller.scrollTop + 24;
    let line = 1;
    for (const b of blocks()) {
      if (b.top > y) break;
      line = b.start;
    }
    return line;
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

  /** Native context menu on the rendered document: copy, export and view options. */
  async function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const { Menu } = await import('@tauri-apps/api/menu');
    const { exportRequest } = await import('../exportRequest.svelte');
    const { copyRichText } = await import('../actions');
    const selection = window.getSelection()?.toString() ?? '';
    const menu = await Menu.new({
      items: [
        { id: 'copy', text: t('ctx.copy'), enabled: !!selection, action: () => void navigator.clipboard.writeText(selection) },
        { id: 'all', text: t('ctx.selectAll'), action: () => { const r = document.createRange(); r.selectNodeContents(body); const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); } },
        { id: 'rich', text: t('cmd.copyRich'), action: () => void copyRichText() },
        { item: 'Separator' },
        { id: 'pdf', text: t('cmd.exportPdf'), action: () => void exportRequest.quick(app.path, 'pdf') },
        { id: 'html', text: t('cmd.exportHtml'), action: () => void exportRequest.quick(app.path, 'html') },
        { id: 'export', text: t('cmd.export'), action: () => (app.exportOpen = true) },
        { id: 'print', text: t('cmd.print'), action: () => window.print() },
        { item: 'Separator' },
        { id: 'pages', text: t('cmd.pages'), checked: settings.pageView, action: () => (settings.pageView = !settings.pageView) },
        { id: 'edit', text: t('ctx.editSource'), action: () => (app.mode = app.mode === 'split' ? 'source' : 'split') },
      ] as any,
    });
    await menu.popup();
  }

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

<div class="preview-scroll" class:desk={paged} bind:this={scroller} onscroll={onScroll}
  style:--page-w="{paper[0]}mm" style:--page-h="{paper[1]}mm" style:--page-m="{settings.pdfMargin}mm">
  <article
    class="markdown-body preview"
    class:paged
    class:justify={settings.justify}
    class:hyphenate={settings.hyphenate}
    bind:this={body}
    onclick={onClick}
    oncontextmenu={onContextMenu}
    role="presentation"
  ></article>
</div>

<style>
  .preview-scroll { height: 100%; overflow-y: auto; overflow-x: hidden; }
  .preview { max-width: var(--doc-width); margin: 0 auto; padding: 36px 32px 30vh; user-select: text; -webkit-user-select: text; cursor: auto; }
  :global(.zen) .preview { padding-top: 12vh; }
  .desk { background: color-mix(in srgb, var(--bg) 82%, #000); }
  :global(.dark) .desk { background: color-mix(in srgb, var(--bg) 70%, #000); }
  .preview.paged { max-width: none; padding: 28px 0 40vh; }
  .preview.paged :global(.page) {
    position: relative; box-sizing: border-box; width: var(--page-w); height: var(--page-h); padding: var(--page-m);
    margin: 0 auto 28px; background: var(--paper, var(--bg)); border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18), 0 10px 30px rgba(0, 0, 0, 0.22);
  }
  .preview.paged :global(.page-inner) { height: 100%; overflow: visible; }
  .preview.paged :global(.page-inner > :first-child) { margin-top: 0; }
  .preview.paged :global(.page::after) {
    content: attr(data-page); position: absolute; left: 0; right: 0; bottom: calc(var(--page-m) * 0.4);
    text-align: center; font: 10px var(--font-ui); color: var(--fg-muted); letter-spacing: 0.04em;
  }
  :global(.markdown-body pre.has-copy .copy-code) {
    position: absolute; top: 6px; right: 6px; font: 11px var(--font-ui); color: var(--fg-muted);
    background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; opacity: 0.0;
    transition: opacity 0.15s; cursor: pointer;
  }
  :global(.markdown-body pre.has-copy:hover .copy-code) { opacity: 1; }
  :global(.markdown-body pre.has-copy .copy-code:hover::after) { content: ' ⧉'; }
</style>
