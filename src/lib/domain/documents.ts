// Pure document and tab rules: no I/O, no framework. The application layer applies them to state.

export type Mode = 'preview' | 'source' | 'split' | 'visual';

export interface Tab {
  id: number;
  path: string | null;
  content: string;
  saved: string;
  mode: Mode;
  /** Line endings on disk; editors always work with "\n". */
  crlf: boolean;
}

export const isTabDirty = (t: Pick<Tab, 'content' | 'saved'>) => t.content !== t.saved;

/** Normalises line endings for editing and remembers whether the file used CRLF. */
export function fromDisk(text: string): { text: string; crlf: boolean } {
  const crlf = text.includes('\r\n');
  return { text: crlf ? text.replace(/\r\n/g, '\n') : text, crlf };
}

export const toDisk = (text: string, crlf: boolean) => (crlf ? text.replace(/\n/g, '\r\n') : text);

/** An empty, never-saved tab that opening a file may reuse instead of adding a new one. */
export const isPristine = (t: Tab | undefined) => !!t && !t.path && t.content === '' && t.saved === '';

/**
 * Mode for a newly opened document: the default when nothing comparable is open, otherwise the
 * current one; non-Markdown files cannot use the visual (WYSIWYG) editor.
 */
export function modeForOpen(o: { current: Mode; defaultMode: Mode; hadDocument: boolean; prevIsText: boolean | null; isText: boolean }): Mode {
  let mode = !o.hadDocument || o.prevIsText === null || o.prevIsText !== o.isText ? o.defaultMode : o.current;
  if (o.isText && mode === 'visual') mode = 'source';
  return mode;
}

/** Index to activate after closing tab `closed` in a list that now has `remaining` tabs. */
export const indexAfterClose = (closed: number, remaining: number) => (remaining ? Math.min(closed, remaining - 1) : -1);

export function cycleIndex(active: number, delta: number, count: number): number {
  return count ? (active + delta + count) % count : -1;
}

/** Indices of the tabs to close for "close others / to the right / to the left", farthest first. */
export function tabsToClose(count: number, anchor: number, which: 'others' | 'right' | 'left'): number[] {
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (i === anchor) continue;
    if (which === 'others' || (which === 'right' && i > anchor) || (which === 'left' && i < anchor)) out.push(i);
  }
  return out;
}

/** Toggles the "- [ ]" task on a 1-based source line; returns null when there is none. */
export function toggleTask(text: string, line: number): string | null {
  const lines = text.split('\n');
  const l = lines[line - 1];
  if (l === undefined) return null;
  const toggled = l.replace(/\[( |x|X)\]/, (_m, c) => (c === ' ' ? '[x]' : '[ ]'));
  if (toggled === l) return null;
  lines[line - 1] = toggled;
  return lines.join('\n');
}

/** Back/forward history of opened documents (⌘[ / ⌘]). */
export class NavigationHistory {
  private back: string[] = [];
  private forward: string[] = [];

  /** A new document was opened from `from` (not by going back or forward). */
  visit(from: string | null) {
    if (!from) return;
    this.back.push(from);
    this.forward = [];
  }
  goBack(current: string | null): string | null {
    const p = this.back.pop() ?? null;
    if (p && current) this.forward.push(current);
    return p;
  }
  goForward(current: string | null): string | null {
    const p = this.forward.pop() ?? null;
    if (p && current) this.back.push(current);
    return p;
  }
  get canGoBack() { return this.back.length > 0; }
  get canGoForward() { return this.forward.length > 0; }
  clear() { this.back = []; this.forward = []; }
}

/** Rewrites a path that sits at or under `from` to the same place under `to` (moves, renames). */
export function retargetPath(p: string, from: string, to: string): string {
  return p === from || p.startsWith(from + '/') || p.startsWith(from + '\\') ? to + p.slice(from.length) : p;
}

export const isUnder = (p: string, dir: string) => p === dir || p.startsWith(dir + '/') || p.startsWith(dir + '\\');
