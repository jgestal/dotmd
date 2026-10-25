// Single registry of user commands. Drives keyboard shortcuts, the command palette (⌘⇧P)
// and the native menu bar, so a command is defined once and behaves the same everywhere.
import { openUrl } from '@tauri-apps/plugin-opener';
import { app, settings, getEditorApi, toast, type Mode } from './state.svelte';
import { services } from './container';
import { t, type Key } from './i18n';
import { isMac, isWindows, isPlainText, basename } from './path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { askFields } from './prompt.svelte';
import { applyToc } from './toc';
import { LANGUAGES } from './i18n';
import { THEMES } from './themes';
import { toggleAppearance } from './appearance.svelte';
import { toggleFavorite } from './workspace.svelte';
import type { FormatAction } from './snippets';
import {
  newDoc, openFileDialog, openFolder, saveDoc, toggleZen, toggleTypewriterMode, insertLink, insertImage,
  toggleFocusHighlight, updateToc, closeTab, closeOtherTabs, closeTabsToLeft, closeTabsToRight, cycleTab, goBack, goForward, canGoBack, canGoForward, toggleFocusWriting, copyRichText,
  typewriterModeOn, renamePath, revertDoc,
} from './actions';
import { focusWriting } from './state.svelte';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exportRequest } from './exportRequest.svelte';

export type MenuId = 'file' | 'edit' | 'format' | 'view' | 'go' | 'help';

export interface Command {
  id: string;
  label: () => string;
  /** Tauri accelerator syntax, e.g. "CmdOrCtrl+Shift+O". */
  shortcut?: string;
  /** Shortcut also handled inside the editors (CodeMirror keymap): only bound to the menu on macOS. */
  editorKey?: boolean;
  menu?: MenuId;
  /** Starts a new group in its menu. */
  separator?: boolean;
  /** Groups the command in a submenu of its menu (label key). */
  submenu?: Key;
  /** Shorter label inside its submenu ("Nord" instead of "Theme: Nord"). */
  menuLabel?: () => string;
  /** Shown with a check mark in the native menu when true. */
  checked?: () => boolean;
  enabled?: () => boolean;
  run: () => unknown;
}

const hasDoc = () => app.docOpen;

async function renameCurrent() {
  if (!app.path) return;
  const name = basename(app.path);
  const v = await askFields(t('cmd.renameFile'), [{ key: 'name', label: t('common.name'), value: name }]);
  if (v?.name && v.name !== name) await renamePath(app.path, v.name);
}

/** Help ▸ Markdown Guide: a cheat sheet in the UI language, opened side by side with its result. */
async function openGuide() {
  const lang = ['es'].includes(settings.lang) ? settings.lang : 'en';
  const text = await fetch(`/guide/${lang}.md`).then((r) => r.text());
  newDoc(applyToc(text), 'split');
}
const editing = () => app.docOpen && app.mode !== 'preview';
const fmt = (a: FormatAction) => () => getEditorApi()?.exec(a);
let lastEditMode: Mode = 'source';

export function setMode(m: Mode) {
  if (isPlainText(app.path) && m === 'visual') return;
  if (m !== 'preview') lastEditMode = m;
  app.mode = m;
}

/** Extra commands contributed by components (tabs, quick open, search…). */
const extra: Command[] = [];
export function registerCommands(cmds: Command[]) {
  for (const c of cmds) {
    const i = extra.findIndex((e) => e.id === c.id);
    if (i >= 0) extra[i] = c;
    else extra.push(c);
  }
}

const L = (k: Key) => () => t(k);

const EDIT_GROUP: Record<string, Key> = {
  find: 'menu.find', findNext: 'menu.find', findPrevious: 'menu.find', replace: 'menu.find', gotoLine: 'menu.find',
  selectNext: 'menu.selection', selectAllMatches: 'menu.selection', cursorAbove: 'menu.selection', cursorBelow: 'menu.selection', selectLine: 'menu.selection',
  duplicateLine: 'menu.lines', deleteLine: 'menu.lines', moveLineUp: 'menu.lines', moveLineDown: 'menu.lines',
  sortLines: 'menu.lines', sortLinesDesc: 'menu.lines', uniqueLines: 'menu.lines', trimTrailing: 'menu.lines', joinLines: 'menu.lines',
  upper: 'menu.transform', lower: 'menu.transform', title: 'menu.transform',
};
const INSERT = new Set(['fmt.link', 'fmt.image', 'fmt.table', 'fmt.codeblock', 'fmt.mermaid', 'fmt.math', 'fmt.footnote', 'fmt.hr', 'fmt.date', 'fmt.pagebreak']);

function base(): Command[] {
  return [
    // File
    { id: 'file.new', label: L('cmd.new'), shortcut: 'CmdOrCtrl+N', menu: 'file', run: () => newDoc() },
    { id: 'file.open', label: L('cmd.open'), shortcut: 'CmdOrCtrl+O', menu: 'file', run: openFileDialog },
    { id: 'file.quickOpen', label: L('cmd.quickOpen'), shortcut: 'CmdOrCtrl+P', menu: 'file', run: () => (app.quickOpen = true) },
    { id: 'file.openFolder', label: L('cmd.openFolder'), shortcut: 'CmdOrCtrl+Shift+O', menu: 'file', run: () => openFolder() },
    { id: 'tab.close', label: L('tabs.close'), shortcut: 'CmdOrCtrl+W', menu: 'file', separator: true, enabled: hasDoc, run: () => closeTab() },
    { id: 'file.favorite', label: L('fav.toggle'), shortcut: 'CmdOrCtrl+Alt+B', menu: 'file', enabled: () => !!app.path, run: () => toggleFavorite(app.path) },
    { id: 'tab.closeOthers', label: L('tabs.closeOthers'), menu: 'file', enabled: () => app.tabs.length > 1, run: () => closeOtherTabs() },
    { id: 'tab.closeRight', label: L('tabs.closeRight'), menu: 'file', enabled: () => app.activeTab < app.tabs.length - 1, run: () => closeTabsToRight() },
    { id: 'tab.closeLeft', label: L('tabs.closeLeft'), menu: 'file', enabled: () => app.activeTab > 0, run: () => closeTabsToLeft() },
    { id: 'window.close', label: L('cmd.closeWindow'), shortcut: 'CmdOrCtrl+Shift+W', menu: 'file', run: () => getCurrentWindow().close() },
    { id: 'file.save', label: L('cmd.save'), shortcut: 'CmdOrCtrl+S', menu: 'file', separator: true, enabled: hasDoc, run: () => saveDoc() },
    { id: 'file.saveAs', label: L('cmd.saveAs'), shortcut: 'CmdOrCtrl+Shift+S', menu: 'file', enabled: hasDoc, run: () => saveDoc(true) },
    { id: 'file.rename', label: L('cmd.renameFile'), menu: 'file', separator: true, enabled: () => !!app.path, run: renameCurrent },
    { id: 'file.revert', label: L('cmd.revert'), menu: 'file', enabled: () => !!app.path && app.content !== app.saved, run: () => revertDoc() },
    { id: 'file.reveal', label: () => t(isMac ? 'cmd.revealMac' : isWindows ? 'cmd.revealWin' : 'cmd.revealLinux'), menu: 'file', enabled: () => !!app.path, run: () => app.path && revealItemInDir(app.path) },
    { id: 'file.export', label: L('cmd.export'), shortcut: 'CmdOrCtrl+Shift+E', menu: 'file', separator: true, run: () => (app.exportOpen = true) },
    { id: 'file.exportPdf', label: L('cmd.exportPdf'), menu: 'file', enabled: hasDoc, run: () => exportRequest.open(app.path, 'pdf') },
    { id: 'file.exportHtml', label: L('cmd.exportHtml'), menu: 'file', enabled: hasDoc, run: () => exportRequest.open(app.path, 'html') },
    { id: 'file.exportSlides', label: L('cmd.exportSlides'), menu: 'file', enabled: () => hasDoc() && !isPlainText(app.path), run: () => exportRequest.slides(app.path) },
    { id: 'file.print', label: L('cmd.print'), menu: 'file', enabled: hasDoc, run: () => window.print() },

    // Edit
    ...([
      ['find', 'CmdOrCtrl+F', true], ['findNext', 'CmdOrCtrl+G', true], ['findPrevious', 'CmdOrCtrl+Shift+G', true],
      ['replace', 'CmdOrCtrl+Alt+R', false], ['gotoLine', 'CmdOrCtrl+Alt+G', true],
      ['selectNext', 'CmdOrCtrl+D', true], ['selectAllMatches', 'CmdOrCtrl+Shift+L', true],
      ['cursorAbove', 'CmdOrCtrl+Alt+Up', true], ['cursorBelow', 'CmdOrCtrl+Alt+Down', true], ['selectLine', 'CmdOrCtrl+L', true],
      ['duplicateLine', 'CmdOrCtrl+Shift+D', true], ['deleteLine', 'CmdOrCtrl+Shift+K', true],
      ['moveLineUp', 'Alt+Up', true], ['moveLineDown', 'Alt+Down', true],
      ['upper', undefined, false], ['lower', undefined, false], ['title', undefined, false],
      ['sortLines', undefined, false], ['sortLinesDesc', undefined, false], ['uniqueLines', undefined, false],
      ['trimTrailing', undefined, false], ['joinLines', undefined, false],
    ] as const).map(([cmd, shortcut, editorKey], i) => ({
      id: `edit.${cmd}`, label: L(`edit.${cmd}` as Key), shortcut, editorKey: editorKey || undefined, menu: 'edit' as const,
      separator: ['sortLines'].includes(cmd) || undefined,
      submenu: EDIT_GROUP[cmd],
      enabled: () => !!getEditorApi()?.run, run: () => getEditorApi()?.run?.(cmd),
    })),
    { id: 'edit.copyRich', label: L('cmd.copyRich'), shortcut: 'CmdOrCtrl+Alt+C', menu: 'edit', enabled: hasDoc, run: copyRichText },

    // Format
    { id: 'fmt.bold', label: L('tb.bold'), shortcut: 'CmdOrCtrl+B', editorKey: true, menu: 'format', enabled: editing, run: fmt({ type: 'bold' }) },
    { id: 'fmt.italic', label: L('tb.italic'), shortcut: 'CmdOrCtrl+I', editorKey: true, menu: 'format', enabled: editing, run: fmt({ type: 'italic' }) },
    { id: 'fmt.strike', label: L('tb.strike'), shortcut: 'CmdOrCtrl+Shift+X', editorKey: true, menu: 'format', enabled: editing, run: fmt({ type: 'strike' }) },
    { id: 'fmt.highlight', label: L('tb.highlight'), shortcut: 'CmdOrCtrl+Shift+H', editorKey: true, menu: 'format', enabled: editing, run: fmt({ type: 'highlight' }) },
    { id: 'fmt.code', label: L('tb.code'), shortcut: 'CmdOrCtrl+Shift+C', editorKey: true, menu: 'format', enabled: editing, run: fmt({ type: 'code' }) },
    ...[1, 2, 3].map((level, i) => ({
      id: `fmt.h${level}`, label: () => `${t('tb.heading')} ${level}`, shortcut: `CmdOrCtrl+Alt+${level}`, editorKey: true,
      menu: 'format' as const, submenu: 'menu.heading' as Key, enabled: editing, run: fmt({ type: 'heading', level }),
    })),
    { id: 'fmt.paragraph', label: L('tb.paragraph'), shortcut: 'CmdOrCtrl+Alt+0', editorKey: true, menu: 'format', submenu: 'menu.heading', enabled: editing, run: fmt({ type: 'paragraph' }) },
    { id: 'fmt.quote', label: L('tb.quote'), menu: 'format', separator: true, enabled: editing, run: fmt({ type: 'quote' }) },
    { id: 'fmt.ul', label: L('tb.ul'), menu: 'format', enabled: editing, run: fmt({ type: 'ul' }) },
    { id: 'fmt.ol', label: L('tb.ol'), menu: 'format', enabled: editing, run: fmt({ type: 'ol' }) },
    { id: 'fmt.task', label: L('tb.task'), menu: 'format', enabled: editing, run: fmt({ type: 'task' }) },
    { id: 'fmt.link', label: L('tb.link'), shortcut: 'CmdOrCtrl+K', editorKey: true, menu: 'format', separator: true, enabled: editing, run: insertLink },
    { id: 'fmt.image', label: L('tb.image'), menu: 'format', enabled: editing, run: insertImage },
    { id: 'fmt.table', label: L('tb.table'), menu: 'format', enabled: editing, run: fmt({ type: 'table', rows: 3, cols: 3 }) },
    { id: 'fmt.formatTable', label: L('tb.tableFormat'), shortcut: 'CmdOrCtrl+Shift+T', editorKey: true, menu: 'format', separator: true, enabled: editing, run: fmt({ type: 'formatTable' }) },
    { id: 'fmt.codeblock', label: L('tb.codeblock'), menu: 'format', enabled: editing, run: fmt({ type: 'codeblock', lang: '' }) },
    { id: 'fmt.mermaid', label: L('tb.mermaid'), menu: 'format', enabled: editing, run: fmt({ type: 'mermaid', template: 'flowchart' }) },
    { id: 'fmt.math', label: L('tb.math'), menu: 'format', enabled: editing, run: fmt({ type: 'math' }) },
    { id: 'fmt.footnote', label: L('tb.footnote'), menu: 'format', enabled: editing, run: fmt({ type: 'footnote' }) },
    { id: 'fmt.hr', label: L('tb.hr'), menu: 'format', enabled: editing, run: fmt({ type: 'hr' }) },
    { id: 'fmt.date', label: L('tb.date'), menu: 'format', enabled: editing, run: fmt({ type: 'date' }) },

    // View
    ...(['preview', 'source', 'split', 'visual'] as Mode[]).map((m, i) => ({
      id: `view.${m}`, label: L(`mode.${m}` as Key), shortcut: `CmdOrCtrl+${i + 1}`, menu: 'view' as const,
      enabled: () => hasDoc() && !(m === 'visual' && isPlainText(app.path)), checked: () => hasDoc() && app.mode === m, run: () => setMode(m),
    })),
    { id: 'view.pages', label: L('cmd.pages'), shortcut: 'CmdOrCtrl+Alt+P', menu: 'view', checked: () => settings.pageView, run: () => (settings.pageView = !settings.pageView) },
    { id: 'fmt.toc', label: L('tb.toc'), shortcut: 'CmdOrCtrl+Alt+T', menu: 'format', enabled: () => hasDoc() && !isPlainText(app.path), run: updateToc },
    { id: 'view.wrap', label: L('cmd.toggleWrap'), shortcut: 'Alt+Z', menu: 'view', checked: () => settings.lineWrap, run: () => (settings.lineWrap = !settings.lineWrap) },
    { id: 'fmt.pagebreak', label: L('tb.pagebreak'), menu: 'format', enabled: editing, run: fmt({ type: 'pagebreak' }) },
    { id: 'view.toggleEdit', label: L('cmd.toggleEdit'), shortcut: 'CmdOrCtrl+E', menu: 'view', enabled: hasDoc, run: () => setMode(app.mode === 'preview' ? lastEditMode : 'preview') },
    { id: 'view.sidebar', label: L('sidebar.toggle'), shortcut: 'CmdOrCtrl+\\', menu: 'view', separator: true, checked: () => app.sidebar, run: () => (app.sidebar = !app.sidebar) },
    { id: 'view.outline', label: L('cmd.outline'), menu: 'view', run: () => { app.sidebar = true; app.sidebarTab = 'outline'; } },
    { id: 'view.search', label: L('cmd.search'), shortcut: 'CmdOrCtrl+Shift+F', menu: 'view', run: () => { app.sidebar = true; app.sidebarTab = 'search'; app.searchFocus++; } },
    { id: 'view.present', label: L('cmd.present'), shortcut: 'CmdOrCtrl+Alt+Enter', menu: 'view', separator: true, enabled: () => hasDoc() && !isPlainText(app.path), checked: () => app.presenting, run: () => (app.presenting = !app.presenting) },
    { id: 'view.zen', label: L('top.zen'), shortcut: 'CmdOrCtrl+Shift+Enter', menu: 'view', separator: true, checked: () => app.zen, run: toggleZen },
    { id: 'view.focusWriting', label: L('cmd.focusWriting'), shortcut: 'CmdOrCtrl+Alt+F', menu: 'view', checked: focusWriting, run: toggleFocusWriting },
    { id: 'view.focusToggle', label: L('cmd.toggleFocus'), shortcut: 'CmdOrCtrl+Alt+L', menu: 'view', checked: () => settings.focusMode !== 'off' && !settings.focusOnlyZen, run: toggleFocusHighlight },
    { id: 'view.appearance', label: L('cmd.toggleAppearance'), shortcut: 'CmdOrCtrl+Alt+D', menu: 'view', run: toggleAppearance },
    { id: 'view.typewriter', label: L('set.twMode'), menu: 'view', checked: typewriterModeOn, run: toggleTypewriterMode },
    { id: 'view.zoomIn', label: L('cmd.zoomIn'), shortcut: 'CmdOrCtrl+=', menu: 'view', separator: true, run: () => (settings.fontSize = Math.min(32, settings.fontSize + 1)) },
    { id: 'view.zoomOut', label: L('cmd.zoomOut'), shortcut: 'CmdOrCtrl+-', menu: 'view', run: () => (settings.fontSize = Math.max(10, settings.fontSize - 1)) },
    { id: 'view.zoomReset', label: L('cmd.zoomReset'), shortcut: 'CmdOrCtrl+0', menu: 'view', run: () => (settings.fontSize = 16) },
    { id: 'view.toolbar', label: L('cmd.showToolbar'), menu: 'view', separator: true, checked: () => settings.showToolbar, run: () => (settings.showToolbar = !settings.showToolbar) },
    { id: 'view.statusbar', label: L('cmd.showStatusbar'), menu: 'view', checked: () => settings.showStats, run: () => (settings.showStats = !settings.showStats) },
    { id: 'view.palette', label: L('cmd.palette'), shortcut: 'CmdOrCtrl+Shift+P', menu: 'view', separator: true, run: () => (app.paletteOpen = true) },
    // Go
    { id: 'go.back', label: L('go.back'), shortcut: 'CmdOrCtrl+[', menu: 'go', enabled: canGoBack, run: goBack },
    { id: 'go.forward', label: L('go.forward'), shortcut: 'CmdOrCtrl+]', menu: 'go', enabled: canGoForward, run: goForward },
    { id: 'tab.next', label: L('tabs.next'), shortcut: 'Ctrl+Tab', menu: 'go', separator: true, enabled: () => app.tabs.length > 1, run: () => cycleTab(1) },
    { id: 'tab.prev', label: L('tabs.prev'), shortcut: 'Ctrl+Shift+Tab', menu: 'go', enabled: () => app.tabs.length > 1, run: () => cycleTab(-1) },
    { id: 'tab.nextAlt', label: L('tabs.next'), shortcut: 'CmdOrCtrl+Alt+Right', enabled: () => app.tabs.length > 1, run: () => cycleTab(1) },
    { id: 'tab.prevAlt', label: L('tabs.prev'), shortcut: 'CmdOrCtrl+Alt+Left', enabled: () => app.tabs.length > 1, run: () => cycleTab(-1) },
    { id: 'app.settings', label: L('top.settings'), shortcut: 'CmdOrCtrl+,', run: () => (app.settingsOpen = !app.settingsOpen) },

    // Themes and languages: View ▸ Theme / Language in the menu, "Theme: …" in the palette.
    ...[{ id: 'auto', name: '' }, ...THEMES].map((th, i) => ({
      id: `theme.${th.id}`, label: () => `${t('set.theme')}: ${th.id === 'auto' ? t('set.themeAuto') : th.name}`,
      menuLabel: () => (th.id === 'auto' ? t('set.themeAuto') : th.name),
      menu: 'view' as const, submenu: 'menu.theme' as Key, separator: i <= 1 || undefined,
      checked: () => settings.theme === th.id, run: () => (settings.theme = th.id),
    })),
    ...LANGUAGES.map((l) => ({
      id: `lang.${l.id}`, label: () => `${t('set.language')}: ${l.label}`, menuLabel: () => l.label,
      menu: 'view' as const, submenu: 'menu.language' as Key, checked: () => settings.lang === l.id, run: () => (settings.lang = l.id),
    })),

    // Help
    { id: 'help.guide', label: L('cmd.markdownGuide'), menu: 'help', run: openGuide },
    { id: 'help.shortcuts', label: L('cmd.shortcuts'), shortcut: 'CmdOrCtrl+Alt+/', menu: 'help', run: () => (app.shortcutsOpen = !app.shortcutsOpen) },
    { id: 'help.website', label: L('cmd.website'), menu: 'help', separator: true, run: () => openUrl('https://github.com/jgestal/dotmd#readme') },
    { id: 'help.releaseNotes', label: L('cmd.releaseNotes'), menu: 'help', run: () => openUrl('https://github.com/jgestal/dotmd/blob/main/CHANGELOG.md') },
    { id: 'help.issue', label: L('cmd.reportIssue'), menu: 'help', run: () => openUrl('https://github.com/jgestal/dotmd/issues/new') },
    {
      id: 'help.installCli', label: L('cmd.installCli'), menu: 'help', separator: true,
      run: () => services.process.installCli().then((path) => toast(t('toast.cliInstalled', { path }), 6000), (e) => toast(t('toast.error', { msg: String(e) }))),
    },
    { id: 'help.updates', label: L('cmd.checkUpdates'), menu: 'help', separator: true, run: () => import('./updates').then((m) => m.checkForUpdates(true)) },
  ];
}

export function allCommands(): Command[] {
  const list = base().map((c) => (INSERT.has(c.id) ? { ...c, submenu: 'menu.insert' as Key } : c));
  for (const e of extra) {
    const i = list.findIndex((c) => c.id === e.id);
    if (i >= 0) list[i] = e;
    else list.push(e);
  }
  return list;
}

export type MenuNode =
  | { kind: 'command'; command: Command }
  | { kind: 'separator' }
  | { kind: 'submenu'; label: Key; items: MenuNode[] };

/**
 * Layout of one native menu: commands in registry order, those with a `submenu` gathered into it
 * where the first of them appears, separators where a group starts (never leading or doubled).
 */
export function menuTree(commands: Command[], menu: MenuId): MenuNode[] {
  const out: MenuNode[] = [];
  const subs = new Map<Key, MenuNode[]>();
  const push = (list: MenuNode[], c: Command) => {
    if (c.separator && list.length && list[list.length - 1].kind !== 'separator') list.push({ kind: 'separator' });
    list.push({ kind: 'command', command: c });
  };
  for (const c of commands.filter((c) => c.menu === menu)) {
    if (!c.submenu) { push(out, c); continue; }
    let items = subs.get(c.submenu);
    if (!items) {
      items = [];
      subs.set(c.submenu, items);
      if (c.separator && out.length && out[out.length - 1].kind !== 'separator') out.push({ kind: 'separator' });
      out.push({ kind: 'submenu', label: c.submenu, items });
      push(items, { ...c, separator: undefined });
    } else push(items, c);
  }
  return out;
}

let lastRun = { id: '', at: 0 };

/** Runs a command once even if both the menu accelerator and the webview keydown fire. */
export function runCommand(c: Command) {
  if (c.enabled && !c.enabled()) return;
  const now = performance.now();
  if (lastRun.id === c.id && now - lastRun.at < 150) return;
  lastRun = { id: c.id, at: now };
  void c.run();
}

/** "CmdOrCtrl+Shift+O" → "⌘⇧O" on macOS, "Ctrl+Shift+O" elsewhere. */
export function formatShortcut(acc?: string): string {
  if (!acc) return '';
  const parts = acc.split('+').map((p) => p === '' ? '+' : p);
  if (!isMac) return parts.map((p) => (p === 'CmdOrCtrl' ? 'Ctrl' : p)).join('+');
  const sym: Record<string, string> = { CmdOrCtrl: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃', Enter: '↩', Backspace: '⌫', Tab: '⇥', Up: '↑', Down: '↓', Left: '←', Right: '→' };
  return parts.map((p) => sym[p] ?? p.toUpperCase()).join('');
}

function matches(acc: string, e: KeyboardEvent): boolean {
  const parts = acc.split('+');
  const key = parts.pop()!;
  const want = new Set(parts);
  if (isMac) {
    if (want.has('CmdOrCtrl') !== e.metaKey || want.has('Ctrl') !== e.ctrlKey) return false;
  } else if ((want.has('CmdOrCtrl') || want.has('Ctrl')) !== e.ctrlKey || e.metaKey) return false;
  if (want.has('Shift') !== e.shiftKey) return false;
  if (want.has('Alt') !== e.altKey) return false;
  const code = e.code;
  if (/^[0-9]$/.test(key)) return code === `Digit${key}` || code === `Numpad${key}`;
  if (/^[A-Z]$/i.test(key)) return code === `Key${key.toUpperCase()}`;
  if (key === '/') return code === 'Slash' || code === 'NumpadDivide';
  const special: Record<string, string[]> = {
    Enter: ['Enter', 'NumpadEnter'], '\\': ['Backslash', 'IntlBackslash'], '[': ['BracketLeft'], ']': ['BracketRight'],
    '=': ['Equal', 'NumpadAdd'], '-': ['Minus', 'NumpadSubtract'], ',': ['Comma'], Tab: ['Tab'], Left: ['ArrowLeft'], Right: ['ArrowRight'], Up: ['ArrowUp'], Down: ['ArrowDown'],
  };
  return (special[key] ?? [key]).includes(code);
}

/** Global keydown handler. Editor-owned shortcuts are left to the editors. */
export function handleShortcut(e: KeyboardEvent): boolean {
  for (const c of allCommands()) {
    if (!c.shortcut || c.editorKey) continue;
    if (matches(c.shortcut, e)) {
      e.preventDefault();
      runCommand(c);
      return true;
    }
  }
  return false;
}
