<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createSource, execSource } from '../editor/source';
  import { app, settings, setEditorApi, focusActive, typewriterActive, soundActive } from '../state.svelte';
  import { isMarkdown } from '../path';
  import { keySound } from '../sound';
  import { insertLink } from '../actions';

  let { onScrollLine }: { onScrollLine?: (line: number) => void } = $props();

  let host: HTMLElement;
  let ed: ReturnType<typeof createSource> | null = null;
  const md = () => !app.path || isMarkdown(app.path);

  onMount(() => {
    ed = createSource(host, {
      doc: app.content,
      markdown: md(),
      lineNumbers: settings.lineNumbers,
      wrap: settings.lineWrap,
      spellcheck: settings.spellcheck,
      focus: focusActive() ? settings.focusMode : 'off',
      typewriter: typewriterActive(),
      onChange: (text) => (app.content = text),
      onSelection: (text) => (app.selection = text),
      onKey: (key, col) => soundActive() && keySound(key, col),
      onScroll: (line) => onScrollLine?.(line),
    });
    const view = ed.view;
    setEditorApi({
      exec: (a) => execSource(view, a),
      focus: () => view.focus(),
      revealLine: (line) => ed?.revealLine(line),
    });
    view.dom.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); insertLink(); }
    });
    view.focus();
    return () => {
      setEditorApi(null);
      ed?.destroy();
      ed = null;
    };
  });

  // Content replaced from outside (file opened, reloaded, task toggled in preview).
  $effect(() => {
    app.extVersion;
    untrack(() => ed?.setDoc(app.content));
  });
  $effect(() => {
    const p = { lineNumbers: settings.lineNumbers, wrap: settings.lineWrap, spellcheck: settings.spellcheck };
    untrack(() => ed?.reconfigure(p));
  });
  $effect(() => {
    const p = { focus: focusActive() ? settings.focusMode : ('off' as const), typewriter: typewriterActive() };
    untrack(() => ed?.reconfigure(p));
  });
  $effect(() => {
    const p = { markdown: md() };
    untrack(() => ed?.reconfigure(p));
  });
  $effect(() => {
    const r = app.reveal;
    if (r.n && (app.mode === 'source' || app.mode === 'split')) untrack(() => ed?.revealLine(r.line));
  });
</script>

<div class="source" class:md={md()} bind:this={host}></div>

<style>
  .source { height: 100%; overflow: hidden; }
  .source.md { --font-editor: var(--font-doc); }
  :global(.cm-focus-mode .cm-dim-line), :global(.cm-focus-mode .cm-dim) { opacity: 0.28; transition: opacity 0.18s; }
  :global(.cm-focus-mode .cm-activeLine) { background: transparent !important; }
  :global(.cm-typewriter .cm-content) { padding-top: 45vh !important; padding-bottom: 50vh !important; }
  :global(.cm-editor .cm-content) { user-select: text; -webkit-user-select: text; }
</style>
