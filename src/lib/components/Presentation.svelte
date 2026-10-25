<script lang="ts">
  // Full-screen slide show of the open document. Slides are laid out on a 16:9 canvas that is
  // scaled to the window, so they look the same at any size and in the PDF export.
  import { onMount, tick } from 'svelte';
  import { services } from '../container';
  import { app } from '../state.svelte';
  import { t } from '../i18n';
  import { dirname } from '../path';
  import { renderHtml, postProcess } from '../render';
  import { currentTheme, sheet, sheetClass } from '../appearance.svelte';
  import { fitSlide, slideAt, splitSlides, type Slide } from '../slides';

  let slides = $state<Slide[]>([]);
  let index = $state(0);
  let showNotes = $state(false);
  let scale = $state(1);
  let body = $state<HTMLElement>();
  let ready = $state(false);
  const W = 1280, H = 720;

  const theme = currentTheme();
  const slide = $derived(slides[index]);

  function resize() {
    scale = Math.min(window.innerWidth / W, (window.innerHeight - (showNotes ? 160 : 0)) / H);
  }

  function go(i: number) {
    index = Math.max(0, Math.min(slides.length - 1, i));
  }

  function exit() {
    app.presenting = false;
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key;
    let handled = true;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) go(index + (e.shiftKey && k === ' ' ? -1 : 1));
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) go(index - 1);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(slides.length - 1);
    else if (k === 'Escape') exit();
    else if (k === 'n' || k === 'N' || k === 's') { showNotes = !showNotes; resize(); }
    else handled = false;
    if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  // Long slides shrink to fit instead of being cut.
  $effect(() => {
    void slide;
    void tick().then(() => body && fitSlide(body));
  });

  onMount(() => {
    const startLine = app.mode === 'preview' ? app.viewLine : app.cursor.line;
    (async () => {
      const host = document.createElement('div');
      host.className = 'markdown-body';
      host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1100px;visibility:hidden';
      host.innerHTML = await renderHtml(app.content);
      document.body.appendChild(host);
      try {
        await postProcess(host, { dir: app.path ? dirname(app.path) : null, theme });
      } finally {
        host.remove();
      }
      slides = splitSlides(host);
      index = slideAt(slides, startLine);
      ready = true;
    })();
    void services.window.setFullscreen(true);
    resize();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', resize);
      if (!app.zen) void services.window.setFullscreen(false);
    };
  });
</script>

<div class="presentation {sheetClass()}" use:sheet class:with-notes={showNotes} role="presentation" onclick={(e) => { if (!(e.target as HTMLElement).closest('.notes')) go(index + (e.clientX < window.innerWidth / 4 ? -1 : 1)); }}>
  {#if ready && !slides.length}
    <p class="empty">{t('slides.empty')}</p>
  {:else if slide}
    <div class="stage" style="width:{W}px;height:{H}px;transform:scale({scale})">
      <section class="slide {slide.kind} theme-{theme.kind}" style="--slide-w:{W}px;--slide-h:{H}px">
        <div class="slide-body markdown-body" bind:this={body}>{@html slide.html}</div>
        <footer class="slide-num">{index + 1} / {slides.length}</footer>
      </section>
    </div>
    <div class="progress" style="width:{((index + 1) / slides.length) * 100}%"></div>
    {#if showNotes}
      <aside class="notes markdown-body">
        {#if slide.notes}{@html slide.notes}{:else}<p class="hint">{t('slides.noNotes')}</p>{/if}
      </aside>
    {/if}
  {/if}
  <p class="help">{t('slides.help')}</p>
</div>

<style>
  .presentation { position: fixed; inset: 0; z-index: 2000; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; cursor: default; }
  .presentation.with-notes { padding-bottom: 160px; box-sizing: border-box; }
  .stage { flex: none; transform-origin: center center; }
  .progress { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--accent); transition: width 0.2s; }
  .notes { position: absolute; left: 0; right: 0; bottom: 3px; height: 150px; overflow: auto; padding: 12px 24px; background: var(--bg-elev); border-top: 1px solid var(--border); font-size: 15px; }
  .help { position: absolute; top: 8px; right: 14px; margin: 0; font: 11px var(--font-ui); color: var(--fg-muted); opacity: 0; transition: opacity 0.3s; }
  .presentation:hover .help { opacity: 0.8; }
  .empty { color: var(--fg-muted); font: 15px var(--font-ui); }
</style>
