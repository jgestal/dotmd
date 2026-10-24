<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { createSource, execSource } from '../editor/source';
  import { app, settings, setEditorApi, focusModeNow, typewriterActive, soundActive } from '../state.svelte';
  import { docKind } from '../path';
  import { keySound } from '../sound';
  import { insertLink, insertImageFiles } from '../actions';

  let { onScrollLine, syncLine = 0 }: { onScrollLine?: (line: number) => void; syncLine?: number } = $props();
  let quietUntil = 0;

  let host: HTMLElement;
  let ed: ReturnType<typeof createSource> | null = null;
  // Prose (Markdown, plain text) uses the document font; code and data use the code font.
  const md = () => ['markdown', 'text'].includes(docKind(app.path));
  /** Code and data files always get line numbers. */
  const lineNumbers = () => settings.lineNumbers || !md();

  onMount(() => {
    ed = createSource(host, {
      doc: app.content,
      filename: app.path,
      lineNumbers: lineNumbers(),
      wrap: settings.lineWrap,
      spellcheck: settings.spellcheck,
      focus: focusModeNow(),
      typewriter: typewriterActive(),
      onChange: (text) => (app.content = text),
      onSelection: (text) => (app.selection = text),
      onCursor: (line, col) => { app.cursor = { line, col }; app.viewLine = line; },
      onKey: (key, col) => soundActive() && keySound(key, col),
      onScroll: (line) => performance.now() > quietUntil && onScrollLine?.(line),
      onImages: (files) => void insertImageFiles(files),
      markdownPaste: () => docKind(app.path) === 'markdown',
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
    const p = { lineNumbers: lineNumbers(), wrap: settings.lineWrap, spellcheck: settings.spellcheck && md() };
    untrack(() => ed?.reconfigure(p));
  });
  $effect(() => {
    const p = { focus: focusModeNow(), typewriter: typewriterActive() };
    untrack(() => ed?.reconfigure(p));
  });
  $effect(() => {
    const p = { filename: app.path };
    untrack(() => ed?.reconfigure(p));
  });
  // Follow the preview while scrolling it in split mode.
  $effect(() => {
    const line = syncLine;
    if (line > 0) untrack(() => { quietUntil = performance.now() + 200; ed?.scrollToLine(line); });
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
