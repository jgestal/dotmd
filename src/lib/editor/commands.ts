// Text editing commands for the source editor (menu Edit, palette): search, multi-cursor and
// line operations, à la VS Code / Sublime Text.
import { EditorSelection, type SelectionRange } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { copyLineDown, copyLineUp, deleteLine, moveLineDown, moveLineUp, selectLine } from '@codemirror/commands';
import { openSearchPanel, findNext, findPrevious, gotoLine, selectNextOccurrence, selectSelectionMatches } from '@codemirror/search';

export type SourceCommand =
  | 'find' | 'findNext' | 'findPrevious' | 'replace' | 'gotoLine' | 'selectNext' | 'selectAllMatches'
  | 'cursorAbove' | 'cursorBelow' | 'selectLine' | 'duplicateLine' | 'deleteLine' | 'moveLineUp' | 'moveLineDown'
  | 'upper' | 'lower' | 'title' | 'sortLines' | 'sortLinesDesc' | 'uniqueLines' | 'trimTrailing' | 'joinLines';

/** A cursor on the line above/below each existing one, at the same column (multi-line editing). */
function addCursor(view: EditorView, dir: -1 | 1): boolean {
  const { state } = view;
  const added: SelectionRange[] = [];
  for (const r of state.selection.ranges) {
    const line = state.doc.lineAt(r.head);
    const n = line.number + dir;
    if (n < 1 || n > state.doc.lines) continue;
    const target = state.doc.line(n);
    added.push(EditorSelection.cursor(target.from + Math.min(r.head - line.from, target.length)));
  }
  if (!added.length) return false;
  view.dispatch({ selection: EditorSelection.create([...state.selection.ranges, ...added], state.selection.ranges.length + added.length - 1), scrollIntoView: true });
  return true;
}

/** Applies `fn` to each selection (or the word/line under the cursor). */
function mapSelections(view: EditorView, fn: (s: string) => string, wholeLines = false) {
  const { state } = view;
  view.dispatch(
    state.changeByRange((r) => {
      let from = r.from, to = r.to;
      if (wholeLines || r.empty) {
        const word = !wholeLines && state.wordAt(r.head);
        if (word) ({ from, to } = word);
        else { from = state.doc.lineAt(r.from).from; to = state.doc.lineAt(r.to).to; }
      }
      const text = fn(state.sliceDoc(from, to));
      return { changes: { from, to, insert: text }, range: EditorSelection.range(from, from + text.length) };
    }),
  );
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-_(¡¿"'])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());

/** Line operations on the selected lines (or the whole document when nothing is selected). */
function mapLines(view: EditorView, fn: (lines: string[]) => string[]) {
  const { state } = view;
  const r = state.selection.main;
  const whole = r.empty;
  const from = whole ? 0 : state.doc.lineAt(r.from).from;
  const to = whole ? state.doc.length : state.doc.lineAt(r.to).to;
  const out = fn(state.sliceDoc(from, to).split('\n')).join('\n');
  view.dispatch({ changes: { from, to, insert: out }, selection: EditorSelection.range(from, from + out.length) });
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function runSourceCommand(view: EditorView, cmd: SourceCommand): boolean {
  switch (cmd) {
    case 'find': return openSearchPanel(view);
    case 'findNext': return findNext(view);
    case 'findPrevious': return findPrevious(view);
    case 'replace': {
      openSearchPanel(view);
      requestAnimationFrame(() => (view.dom.querySelector('.cm-search input[name=replace]') as HTMLInputElement | null)?.focus());
      return true;
    }
    case 'gotoLine': return gotoLine(view);
    case 'selectNext': return selectNextOccurrence(view);
    case 'selectAllMatches': return selectSelectionMatches(view);
    case 'cursorAbove': return addCursor(view, -1);
    case 'cursorBelow': return addCursor(view, 1);
    case 'selectLine': return selectLine(view);
    case 'duplicateLine': return copyLineDown(view);
    case 'deleteLine': return deleteLine(view);
    case 'moveLineUp': return moveLineUp(view);
    case 'moveLineDown': return moveLineDown(view);
    case 'upper': mapSelections(view, (s) => s.toUpperCase()); return true;
    case 'lower': mapSelections(view, (s) => s.toLowerCase()); return true;
    case 'title': mapSelections(view, titleCase); return true;
    case 'sortLines': mapLines(view, (l) => [...l].sort(collator.compare)); return true;
    case 'sortLinesDesc': mapLines(view, (l) => [...l].sort(collator.compare).reverse()); return true;
    case 'uniqueLines': mapLines(view, (l) => [...new Set(l)]); return true;
    case 'trimTrailing': mapLines(view, (l) => l.map((x) => x.replace(/[ \t]+$/, ''))); return true;
    case 'joinLines': mapLines(view, (l) => [l.map((x) => x.trim()).filter(Boolean).join(' ')]); return true;
  }
  return false;
}

export { copyLineUp };
