import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, dropCursor, highlightSpecialChars, rectangularSelection, crosshairCursor, Decoration, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { runSourceCommand } from './commands';
import { EditorState, Compartment, EditorSelection, RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { LanguageDescription } from '@codemirror/language';
import { basename, isMarkdown } from '../path';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import { syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { htmlToMarkdown, linkFromPaste, shouldConvertHtml } from '../paste';
import { tags as t } from '@lezer/highlight';
import { blockMarkdown, formatTable, longDate, today, type FormatAction } from '../snippets';
import { linkAt } from '../links';
import type { FocusMode } from '../state.svelte';

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: '1.6em', fontWeight: '700', fontFamily: 'var(--font-heading)' },
  { tag: t.heading2, fontSize: '1.35em', fontWeight: '700', fontFamily: 'var(--font-heading)' },
  { tag: t.heading3, fontSize: '1.15em', fontWeight: '650', fontFamily: 'var(--font-heading)' },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: '650', fontFamily: 'var(--font-heading)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--link)' },
  { tag: t.monospace, fontFamily: 'var(--font-code)', color: 'var(--code-fg)' },
  { tag: t.quote, color: 'var(--fg-muted)', fontStyle: 'italic' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--fg-muted)' },
  { tag: t.list, color: 'var(--accent)' },
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--syn-func)' },
  { tag: [t.typeName, t.className, t.propertyName, t.attributeName], color: 'var(--syn-type)' },
]);

const baseTheme = EditorView.theme({
  '&': { height: '100%', background: 'transparent', color: 'var(--fg)', fontSize: 'var(--doc-size)' },
  '.cm-scroller': { fontFamily: 'var(--font-editor, var(--font-code))', lineHeight: 'var(--line-height)', overflow: 'auto' },
  '.cm-content': { maxWidth: 'var(--doc-width)', margin: '0 auto', padding: '32px 28px 40vh', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0' },
  '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--fg-dim)' },
  '.cm-activeLine': { background: 'color-mix(in srgb, var(--bg-hover) 60%, transparent)' },
  '.cm-activeLineGutter': { background: 'transparent', color: 'var(--fg-muted)' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { background: 'var(--sel) !important' },
  '.cm-searchMatch': { background: 'var(--mark)' },
  '.cm-panels': { background: 'var(--bg-elev)', color: 'var(--fg)', borderColor: 'var(--border)' },
  '.cm-panels input, .cm-panels button': { fontFamily: 'var(--font-ui)' },
  '&.cm-focused': { outline: 'none' },
});

// ---- Focus highlighting (iA Writer style): dims everything but the current line/sentence/paragraph.

const dimMark = Decoration.mark({ class: 'cm-dim' });
const dimLine = Decoration.line({ class: 'cm-dim-line' });

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'sentence' }) : null;

function focusDecorations(view: EditorView, mode: FocusMode): DecorationSet {
  const { state } = view;
  const head = state.selection.main.head;
  const doc = state.doc;
  const cur = doc.lineAt(head);
  let first = cur.number, last = cur.number;
  if (mode !== 'line') {
    while (first > 1 && doc.line(first - 1).text.trim() !== '') first--;
    while (last < doc.lines && doc.line(last + 1).text.trim() !== '') last++;
  }
  let sentFrom = -1, sentTo = -1;
  if (mode === 'sentence' && segmenter) {
    const from = doc.line(first).from, to = doc.line(last).to;
    const text = doc.sliceString(from, to);
    const rel = head - from;
    for (const s of segmenter.segment(text)) {
      if (rel >= s.index && rel <= s.index + s.segment.length) {
        sentFrom = from + s.index;
        sentTo = from + s.index + s.segment.trimEnd().length;
        break;
      }
    }
  }
  const b = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const inFocus = line.number >= first && line.number <= last;
      if (!inFocus) b.add(line.from, line.from, dimLine);
      else if (sentFrom >= 0) {
        const end = Math.min(line.to, sentFrom);
        if (line.from < end) b.add(line.from, end, dimMark);
        const start = Math.max(line.from, sentTo);
        if (start < line.to) b.add(start, line.to, dimMark);
      }
      pos = line.to + 1;
    }
  }
  return b.finish();
}

/** Screen line (after soft wrapping) holding the caret; measured outside the update cycle. */
const setScreenLine = StateEffect.define<{ from: number; to: number }>();

/**
 * "Current line" focus for prose: a Markdown paragraph is one logical line that wraps over many
 * screen lines, so we light only the wrapped line being typed and dim the rest of the paragraph.
 */
const screenLineFocus = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    range = { from: -1, to: -1 };
    constructor(view: EditorView) {
      this.measure(view);
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      for (const tr of u.transactions) for (const e of tr.effects) if (e.is(setScreenLine)) this.range = e.value;
      if (u.docChanged || u.selectionSet || u.viewportChanged || u.geometryChanged) this.measure(u.view);
      this.decorations = this.build(u.view);
    }
    measure(view: EditorView) {
      view.requestMeasure({
        key: this,
        read: (v) => {
          const cur = EditorSelection.cursor(v.state.selection.main.head);
          return { from: v.moveToLineBoundary(cur, false).head, to: v.moveToLineBoundary(cur, true).head };
        },
        write: (r, v) => {
          if (r.from !== this.range.from || r.to !== this.range.to) queueMicrotask(() => v.dispatch({ effects: setScreenLine.of(r) }));
        },
      });
    }
    build(view: EditorView): DecorationSet {
      const { doc } = view.state;
      const cur = doc.lineAt(view.state.selection.main.head);
      const b = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          const line = doc.lineAt(pos);
          if (line.number !== cur.number) b.add(line.from, line.from, dimLine);
          else if (this.range.from >= line.from && this.range.to <= line.to) {
            if (this.range.from > line.from) b.add(line.from, this.range.from, dimMark);
            if (this.range.to < line.to) b.add(this.range.to, line.to, dimMark);
          }
          pos = line.to + 1;
        }
      }
      return b.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

function focusPlugin(mode: FocusMode): Extension {
  if (mode === 'off') return [];
  if (mode === 'line') return [screenLineFocus, EditorView.editorAttributes.of({ class: 'cm-focus-mode' })];
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;
        constructor(view: EditorView) { this.decorations = focusDecorations(view, mode); }
        update(u: ViewUpdate) {
          if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = focusDecorations(u.view, mode);
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.editorAttributes.of({ class: 'cm-focus-mode' }),
  ];
}

function typewriterPlugin(on: boolean): Extension {
  if (!on) return [];
  return [
    EditorView.editorAttributes.of({ class: 'cm-typewriter' }),
    EditorView.updateListener.of((u) => {
      if (!(u.selectionSet || u.docChanged) || !u.view.hasFocus) return;
      const head = u.state.selection.main.head;
      requestAnimationFrame(() => u.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) }));
    }),
  ];
}

// ---- Formatting commands

function wrap(view: EditorView, mark: string, placeholder = 'text') {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      const sel = state.sliceDoc(range.from, range.to);
      const before = state.sliceDoc(range.from - mark.length, range.from);
      const after = state.sliceDoc(range.to, range.to + mark.length);
      if (before === mark && after === mark) {
        return {
          changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }],
          range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
        };
      }
      if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= mark.length * 2) {
        const inner = sel.slice(mark.length, sel.length - mark.length);
        return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) };
      }
      const text = sel || placeholder;
      return {
        changes: { from: range.from, to: range.to, insert: mark + text + mark },
        range: EditorSelection.range(range.from + mark.length, range.from + mark.length + text.length),
      };
    }),
  );
}

const PREFIX_RE = /^(\s*)(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/;

function linePrefix(view: EditorView, kind: 'h' | 'quote' | 'ul' | 'ol' | 'task' | 'p', level = 1) {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const seen = new Set<number>();
  let n = 0;
  const lines: { from: number; text: string }[] = [];
  for (const r of state.selection.ranges) {
    for (let l = state.doc.lineAt(r.from).number; l <= state.doc.lineAt(r.to).number; l++) {
      if (seen.has(l)) continue;
      seen.add(l);
      const line = state.doc.line(l);
      lines.push({ from: line.from, text: line.text });
    }
  }
  const want = (i: number) =>
    kind === 'h' ? '#'.repeat(level) + ' ' : kind === 'quote' ? '> ' : kind === 'ul' ? '- ' : kind === 'task' ? '- [ ] ' : kind === 'ol' ? `${i + 1}. ` : '';
  const allHave = lines.every((l) => {
    const m = l.text.match(PREFIX_RE)!;
    return (m[2] ?? '') !== '' && (m[2] ?? '').replace(/\d+/, '1') === want(0).replace(/\d+/, '1');
  });
  for (const l of lines) {
    const m = l.text.match(PREFIX_RE)!;
    const indent = m[1];
    const existing = m[2] ?? '';
    const insert = allHave ? '' : want(n++);
    changes.push({ from: l.from + indent.length, to: l.from + indent.length + existing.length, insert });
  }
  view.dispatch({ changes });
}

function insertBlock(view: EditorView, text: string) {
  const { state } = view;
  const r = state.selection.main;
  const line = state.doc.lineAt(r.from);
  const atLineStart = r.from === line.from;
  const prevBlank = line.number === 1 || state.doc.line(Math.max(1, line.number - 1)).text.trim() === '';
  let prefix = '';
  if (!atLineStart || line.text.trim() !== '') prefix = '\n\n';
  else if (!prevBlank) prefix = '\n';
  const insert = prefix + text + '\n';
  const at = atLineStart && line.text.trim() === '' ? r.from : line.to;
  // Put the cursor inside the new block: first empty line, or after "] " for callouts.
  const emptyLine = text.indexOf('\n\n');
  const cursor = at + prefix.length + (emptyLine >= 0 ? emptyLine + 1 : text.length);
  view.dispatch({ changes: { from: at, to: r.from === at ? r.to : at, insert }, selection: { anchor: cursor } });
}

function formatTableAtCursor(view: EditorView) {
  const { state } = view;
  const cur = state.doc.lineAt(state.selection.main.head);
  if (!cur.text.trim().startsWith('|')) return;
  let a = cur.number, b = cur.number;
  while (a > 1 && state.doc.line(a - 1).text.trim().startsWith('|')) a--;
  while (b < state.doc.lines && state.doc.line(b + 1).text.trim().startsWith('|')) b++;
  const lines: string[] = [];
  for (let i = a; i <= b; i++) lines.push(state.doc.line(i).text);
  const out = formatTable(lines).join('\n');
  view.dispatch({ changes: { from: state.doc.line(a).from, to: state.doc.line(b).to, insert: out } });
}

export function execSource(view: EditorView, a: FormatAction) {
  switch (a.type) {
    case 'bold': wrap(view, '**'); break;
    case 'italic': wrap(view, '*'); break;
    case 'strike': wrap(view, '~~'); break;
    case 'code': wrap(view, '`', 'code'); break;
    case 'highlight': wrap(view, '=='); break;
    case 'heading': linePrefix(view, 'h', a.level); break;
    case 'paragraph': linePrefix(view, 'p'); break;
    case 'quote': linePrefix(view, 'quote'); break;
    case 'ul': linePrefix(view, 'ul'); break;
    case 'ol': linePrefix(view, 'ol'); break;
    case 'task': linePrefix(view, 'task'); break;
    case 'link': {
      const r = view.state.selection.main;
      const text = a.text || view.state.sliceDoc(r.from, r.to) || 'link';
      const insert = `[${text}](${a.url})`;
      view.dispatch({ changes: { from: r.from, to: r.to, insert }, selection: { anchor: r.from + insert.length } });
      break;
    }
    case 'image': {
      const r = view.state.selection.main;
      const insert = blockMarkdown(a)!;
      view.dispatch({ changes: { from: r.from, to: r.to, insert }, selection: { anchor: r.from + insert.length } });
      break;
    }
    case 'footnote': {
      const doc = view.state.doc.toString();
      let n = 1;
      while (doc.includes(`[^${n}]`)) n++;
      const r = view.state.selection.main;
      const end = view.state.doc.length;
      const def = `${doc.endsWith('\n') ? '' : '\n'}\n[^${n}]: `;
      view.dispatch({
        changes: [{ from: r.to, insert: `[^${n}]` }, { from: end, insert: def }],
        selection: { anchor: end + `[^${n}]`.length + def.length },
        scrollIntoView: true,
      });
      break;
    }
    case 'date': {
      const r = view.state.selection.main;
      const text = a.long ? longDate() : today();
      view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + text.length } });
      break;
    }
    case 'formatTable': formatTableAtCursor(view); break;
    default: {
      const md = blockMarkdown(a);
      if (md) insertBlock(view, md);
    }
  }
  view.focus();
}

const fmt = (a: FormatAction) => (v: EditorView) => (execSource(v, a), true);

export interface SourceOptions {
  doc: string;
  /** Document path; picks Markdown or the code language to highlight (null = untitled Markdown). */
  filename: string | null;
  lineNumbers: boolean;
  wrap: boolean;
  spellcheck: boolean;
  focus: FocusMode;
  typewriter: boolean;
  onChange: (text: string) => void;
  onSelection: (text: string) => void;
  onCursor?: (line: number, col: number) => void;
  onKey: (key: string, column: number) => void;
  onScroll: (topLine: number) => void;
  onImages: (files: File[]) => void;
  /** Convert rich-text (HTML) pastes to Markdown: only for Markdown documents. */
  markdownPaste: () => boolean;
  /** ⌘-click (Ctrl-click) on a link or URL in the text. */
  onOpenLink?: (href: string) => void;
}


export function createSource(parent: HTMLElement, o: SourceOptions) {
  const cLines = new Compartment(), cWrap = new Compartment(), cSpell = new Compartment();
  const cFocus = new Compartment(), cType = new Compartment(), cLang = new Compartment();

  const mdExt = () => yamlFrontmatter({ content: markdown({ base: markdownLanguage, codeLanguages: languages }) });
  // Code languages load lazily, so the first paint is never blocked by a parser download.
  let langSeq = 0;
  const setLanguage = (filename: string | null) => {
    const my = ++langSeq;
    if (isMarkdown(filename)) return view.dispatch({ effects: cLang.reconfigure(mdExt()) });
    const desc = filename ? LanguageDescription.matchFilename(languages, basename(filename)) : null;
    if (!desc) return view.dispatch({ effects: cLang.reconfigure([]) });
    desc.load().then((support) => my === langSeq && view.dispatch({ effects: cLang.reconfigure(support) }));
  };
  const spellExt = (on: boolean) => EditorView.contentAttributes.of({ spellcheck: on ? 'true' : 'false', autocorrect: 'off', autocapitalize: 'off' });

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: o.doc,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        closeBrackets(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(), // Alt+drag selects a column
        crosshairCursor(),
        search({ top: true }),
        syntaxHighlighting(mdHighlight),
        baseTheme,
        cLang.of(isMarkdown(o.filename) ? mdExt() : []),
        cLines.of(o.lineNumbers ? lineNumbers() : []),
        cWrap.of(o.wrap ? EditorView.lineWrapping : []),
        cSpell.of(spellExt(o.spellcheck)),
        cFocus.of(focusPlugin(o.focus)),
        cType.of(typewriterPlugin(o.typewriter)),
        keymap.of([
          { key: 'Mod-b', run: fmt({ type: 'bold' }) },
          { key: 'Mod-i', run: fmt({ type: 'italic' }) },
          { key: 'Mod-Shift-x', run: fmt({ type: 'strike' }) },
          { key: 'Mod-Shift-h', run: fmt({ type: 'highlight' }) },
          { key: 'Mod-Shift-c', run: fmt({ type: 'code' }) },
          ...[1, 2, 3, 4, 5, 6].map((level) => ({ key: `Mod-Alt-${level}`, run: fmt({ type: 'heading', level }) })),
          { key: 'Mod-Alt-0', run: fmt({ type: 'paragraph' }) },
          { key: 'Mod-Alt-Shift-t', run: fmt({ type: 'formatTable' }) },
          { key: 'Mod-Alt-ArrowUp', run: (v) => runSourceCommand(v, 'cursorAbove') },
          { key: 'Mod-Alt-ArrowDown', run: (v) => runSourceCommand(v, 'cursorBelow') },
          { key: 'Mod-Shift-d', run: (v) => runSourceCommand(v, 'duplicateLine') },
          { key: 'Mod-Shift-k', run: (v) => runSourceCommand(v, 'deleteLine') },
          { key: 'Mod-l', run: (v) => runSourceCommand(v, 'selectLine') },
          ...closeBracketsKeymap,
          ...searchKeymap,
          ...historyKeymap,
          indentWithTab,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) o.onChange(u.state.doc.toString());
          if (u.selectionSet || u.docChanged) {
            const r = u.state.selection.main;
            o.onSelection(r.empty ? '' : u.state.sliceDoc(r.from, r.to));
            const line = u.state.doc.lineAt(r.head);
            o.onCursor?.(line.number, r.head - line.from + 1);
          }
        }),
        EditorView.domEventHandlers({
          mousedown: (e, view) => {
            if (!o.onOpenLink || !(e.metaKey || e.ctrlKey) || e.button !== 0) return false;
            const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
            if (pos == null) return false;
            const line = view.state.doc.lineAt(pos);
            const href = linkAt(line.text, pos - line.from);
            if (!href) return false;
            e.preventDefault();
            o.onOpenLink(href);
            return true;
          },
          paste: (e, view) => {
            const data = e.clipboardData;
            if (!data) return false;
            const files = [...data.files].filter((f) => f.type.startsWith('image/'));
            if (files.length) {
              e.preventDefault();
              o.onImages(files);
              return true;
            }
            const text = data.getData('text/plain');
            const sel = view.state.selection.main;
            const link = linkFromPaste(view.state.sliceDoc(sel.from, sel.to), text);
            const html = data.getData('text/html');
            let insert = link ?? (o.markdownPaste() && shouldConvertHtml(html, text) ? htmlToMarkdown(html) : null);
            if (insert === null) return false;
            // Converted blocks (headings, lists, tables) need a blank line from the text around them.
            if (!link && /^(#|[-*+] |\d+\. |\||>|```)/m.test(insert)) {
              const line = view.state.doc.lineAt(sel.from);
              const before = view.state.sliceDoc(line.from, sel.from);
              if (before.trim()) insert = '\n\n' + insert;
              else if (line.number > 1 && view.state.doc.line(line.number - 1).text.trim()) insert = '\n' + insert;
            }
            e.preventDefault();
            view.dispatch(view.state.replaceSelection(insert), { scrollIntoView: true, userEvent: 'input.paste' });
            return true;
          },
          scroll: (_e, view) => {
            const block = view.lineBlockAtHeight(view.scrollDOM.getBoundingClientRect().top - view.documentTop);
            o.onScroll(view.state.doc.lineAt(block.from).number);
          },
        }),
      ],
    }),
  });

  if (!isMarkdown(o.filename)) setLanguage(o.filename);

  // Typing sounds listen in the capture phase: keymaps (e.g. Markdown list continuation on Enter)
  // consume their keys before CodeMirror's own event handlers would see them.
  view.contentDOM.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.isComposing || !(e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) return;
    const head = view.state.selection.main.head;
    const col = head - view.state.doc.lineAt(head).from;
    o.onKey(e.key, e.key.length === 1 ? col + 1 : e.key === 'Backspace' ? Math.max(0, col - 1) : 0);
  }, true);

  return {
    view,
    setDoc(text: string) {
      if (text === view.state.doc.toString()) return;
      const head = Math.min(view.state.selection.main.head, text.length);
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: head } });
    },
    reconfigure(p: Partial<SourceOptions>) {
      const effects = [];
      if (p.lineNumbers !== undefined) effects.push(cLines.reconfigure(p.lineNumbers ? lineNumbers() : []));
      if (p.wrap !== undefined) effects.push(cWrap.reconfigure(p.wrap ? EditorView.lineWrapping : []));
      if (p.spellcheck !== undefined) effects.push(cSpell.reconfigure(spellExt(p.spellcheck)));
      if (p.focus !== undefined) effects.push(cFocus.reconfigure(focusPlugin(p.focus)));
      if (p.typewriter !== undefined) effects.push(cType.reconfigure(typewriterPlugin(p.typewriter)));
      if (p.filename !== undefined) setLanguage(p.filename);
      view.dispatch({ effects });
    },
    /** Puts `line` at the top of the viewport without moving the cursor (scroll sync). */
    scrollToLine(line: number) {
      const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      view.dispatch({ effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 8 }) });
    },
    revealLine(line: number) {
      const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 40 }) });
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}
