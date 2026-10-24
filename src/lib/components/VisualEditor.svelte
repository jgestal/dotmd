<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createVisual } from '../editor/visual';
  import { app, settings, setEditorApi, soundActive, focusActive, toast } from '../state.svelte';
  import { currentTheme } from '../appearance.svelte';
  import { dirname } from '../path';
  import { keySound } from '../sound';
  import { insertLink } from '../actions';
  import { t } from '../i18n';

  let host: HTMLElement;
  let ed: Awaited<ReturnType<typeof createVisual>> | null = null;
  let lastSet = '';
  let warned = false;

  onMount(() => {
    let disposed = false;
    createVisual(host, {
      doc: app.content,
      dir: () => (app.path ? dirname(app.path) : null),
      theme: () => currentTheme(),
      placeholder: '…',
      onChange: (md) => {
        lastSet = md;
        app.content = md;
        if (!warned) { warned = true; toast(t('toast.visualNote'), 4000); }
      },
      onKey: (key) => soundActive() && keySound(key),
    }).then((e) => {
      if (disposed) { e.destroy(); return; }
      ed = e;
      lastSet = app.content;
      setEditorApi({ exec: (a) => e.exec(a), focus: () => e.focus() });
      e.focus();
    });
    host.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); insertLink(); }
    }, true);
    return () => {
      disposed = true;
      setEditorApi(null);
      ed?.destroy();
      ed = null;
    };
  });

  $effect(() => {
    app.extVersion;
    untrack(() => {
      if (ed && app.content !== lastSet) { lastSet = app.content; ed.setDoc(app.content); }
    });
  });

  // Paragraph focus for the WYSIWYG editor: mark the top-level block holding the caret.
  function onSelectionChange() {
    if (!focusActive()) return;
    const pm = host?.querySelector('.ProseMirror');
    const node = window.getSelection()?.anchorNode;
    if (!pm || !node || !pm.contains(node)) return;
    let el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null;
    while (el && el.parentElement !== pm) el = el.parentElement;
    pm.querySelectorAll(':scope > .mdv-focus').forEach((n) => n !== el && n.classList.remove('mdv-focus'));
    el?.classList.add('mdv-focus');
  }
</script>

<svelte:document onselectionchange={onSelectionChange} />

<div class="visual-scroll">
  <div
    class="visual markdown-body"
    class:focus-on={focusActive()}
    class:justify={settings.justify}
    class:hyphenate={settings.hyphenate}
    bind:this={host}
    spellcheck={settings.spellcheck}
  ></div>
</div>

<style>
  .visual-scroll { height: 100%; overflow-y: auto; }
  .visual { max-width: var(--doc-width); margin: 0 auto; padding: 20px 0 30vh; user-select: text; -webkit-user-select: text; }
  :global(.zen) .visual { padding-top: 12vh; }
  .visual :global(.milkdown) {
    --crepe-color-background: var(--bg);
    --crepe-color-on-background: var(--fg);
    --crepe-color-surface: var(--bg-elev);
    --crepe-color-surface-low: var(--code-bg);
    --crepe-color-on-surface: var(--fg);
    --crepe-color-on-surface-variant: var(--fg-muted);
    --crepe-color-outline: var(--border);
    --crepe-color-primary: var(--accent);
    --crepe-color-secondary: var(--bg-active);
    --crepe-color-on-secondary: var(--fg);
    --crepe-color-inverse: var(--fg);
    --crepe-color-on-inverse: var(--bg);
    --crepe-color-inline-code: var(--code-fg);
    --crepe-color-error: #cf222e;
    --crepe-color-hover: var(--bg-hover);
    --crepe-color-selected: var(--sel);
    --crepe-color-inline-area: var(--code-bg);
    --crepe-font-title: var(--font-heading);
    --crepe-font-default: var(--font-doc);
    --crepe-font-code: var(--font-code);
    --crepe-base-font-size: var(--doc-size);
    background: transparent;
  }
  .visual :global(.ProseMirror) { padding: 16px 32px !important; outline: none; line-height: var(--line-height); }
  .visual :global(.ProseMirror p) { font-size: var(--doc-size); line-height: var(--line-height); }
  .visual.focus-on :global(.ProseMirror > *) { opacity: 0.28; transition: opacity 0.18s; }
  .visual.focus-on :global(.ProseMirror > .mdv-focus) { opacity: 1; }
</style>
