import { invoke } from '@tauri-apps/api/core';
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { app, isDirty, session, settings, setContent, pushRecent, toast, getEditorApi, type Tab } from './state.svelte';
import { askFields } from './prompt.svelte';
import { preloadSounds } from './sound';
import { t } from './i18n';
import { basename, dirname, isPlainText, isTextPath, join, relative, stem } from './path';

const MD_FILTERS = () => [
  { name: t('dlg.markdown'), extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
  { name: t('dlg.text'), extensions: ['txt', 'text', 'log', 'csv', 'tsv', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'rst', 'org'] },
  { name: t('dlg.all'), extensions: ['*'] },
];

export function docName(path = app.path): string {
  return path ? basename(path) : t('top.untitled');
}

export const APP_TITLE = 'DotMD — Markdown Viewer & Editor';

/** "notes.md — DotMD" with a document, the full product name without one. */
export function windowTitle(): string {
  return app.docOpen ? `${docName()} — DotMD` : APP_TITLE;
}

// ---- Tabs. The active document lives in app.path/content/saved/mode (what the editors bind to);
// app.tabs keeps a snapshot of every open document.

let tabSeq = 0;

/** Copies the active document into its tab entry. */
function snapshot() {
  const tb = app.tabs[app.activeTab];
  if (tb) Object.assign(tb, { path: app.path, content: app.content, saved: app.saved, mode: app.mode });
}

function persistTabs() {
  session.tabs = app.tabs.map((x) => x.path).filter((p): p is string => !!p);
  session.lastFile = app.path;
}

/** Re-arms the file watcher on every open document. */
function rewatch() {
  const paths = [...new Set(app.tabs.map((x) => x.path).filter((p): p is string => !!p))];
  void invoke('watch_files', { paths }).catch(() => {});
}

export function activateTab(i: number) {
  const tb = app.tabs[i];
  if (!tb) return;
  if (i !== app.activeTab) snapshot();
  app.activeTab = i;
  app.path = tb.path;
  app.saved = tb.saved;
  app.content = tb.content;
  app.mode = tb.mode;
  app.docOpen = true;
  app.selection = '';
  app.sessionStartWords = -1;
  app.extVersion++;
  persistTabs();
  void getCurrentWindow().setTitle(windowTitle()).catch(() => {});
}

function addTab(tab: Omit<Tab, 'id'>, reuseActive: boolean) {
  const cur = app.tabs[app.activeTab];
  const pristine = cur && !cur.path && app.content === '' && app.saved === '';
  if (reuseActive && pristine) {
    Object.assign(cur, tab);
    app.activeTab = -1; // force a full load of the reused tab
    activateTab(app.tabs.indexOf(cur));
  } else {
    snapshot();
    const at = app.activeTab + 1;
    app.tabs.splice(at, 0, { id: ++tabSeq, ...tab });
    app.activeTab = -1;
    activateTab(at);
  }
  rewatch();
}

/** Closes a tab, asking to save it first if needed. Returns false if it stayed open. */
export async function closeTab(i = app.activeTab): Promise<boolean> {
  if (!app.tabs[i]) return true;
  if (i !== app.activeTab) activateTab(i);
  if (!(await confirmDiscard())) return false;
  app.tabs.splice(i, 1);
  app.activeTab = -1;
  if (app.tabs.length) activateTab(Math.min(i, app.tabs.length - 1));
  else {
    app.docOpen = false;
    app.path = null;
    app.content = app.saved = '';
    app.extVersion++;
    persistTabs();
    void getCurrentWindow().setTitle(windowTitle()).catch(() => {});
  }
  rewatch();
  return true;
}

export function cycleTab(delta: number) {
  if (app.tabs.length < 2) return;
  activateTab((app.activeTab + delta + app.tabs.length) % app.tabs.length);
}

export function moveTab(from: number, to: number) {
  if (from === to || !app.tabs[from]) return;
  snapshot();
  const activeId = app.tabs[app.activeTab]?.id;
  const [tb] = app.tabs.splice(from, 1);
  app.tabs.splice(to, 0, tb);
  app.activeTab = app.tabs.findIndex((x) => x.id === activeId);
  persistTabs();
}

export function anyDirty(): boolean {
  snapshot();
  return app.tabs.some((x) => x.content !== x.saved);
}

/** Before quitting: offers to save every modified tab. */
export async function confirmCloseAll(): Promise<boolean> {
  snapshot();
  for (let i = 0; i < app.tabs.length; i++) {
    const tb = app.tabs[i];
    if (tb.content === tb.saved) continue;
    activateTab(i);
    if (!(await confirmDiscard())) return false;
  }
  return true;
}

/** Asks what to do with unsaved changes in the active tab. Returns false if saving failed or was cancelled. */
export async function confirmDiscard(): Promise<boolean> {
  if (!isDirty()) return true;
  const saveIt = await ask(t('dlg.unsavedBody', { name: docName() }), {
    title: t('dlg.unsavedTitle'),
    kind: 'warning',
    okLabel: t('dlg.save'),
    cancelLabel: t('dlg.discard'),
  });
  if (saveIt) return await saveDoc();
  return true;
}

// ---- Navigation history (⌘[ / ⌘])

const nav = { back: [] as string[], forward: [] as string[] };
export const canGoBack = () => nav.back.length > 0;
export const canGoForward = () => nav.forward.length > 0;

export async function goBack() {
  const p = nav.back.pop();
  if (!p) return;
  if (app.path) nav.forward.push(app.path);
  await openPath(p, { fromHistory: true });
}

export async function goForward() {
  const p = nav.forward.pop();
  if (!p) return;
  if (app.path) nav.back.push(app.path);
  await openPath(p, { fromHistory: true });
}

export async function openPath(path: string, opts: { fromHistory?: boolean; background?: boolean } = {}) {
  const kind = await invoke<string>('path_kind', { path });
  if (kind === 'dir') return openFolder(path);
  if (kind !== 'file') return;
  if (path === app.path) return;
  if (!opts.fromHistory && app.path) {
    nav.back.push(app.path);
    nav.forward = [];
  }
  const existing = app.tabs.findIndex((x) => x.path === path);
  if (existing >= 0) return activateTab(existing);
  try {
    const text = await invoke<string>('read_text', { path });
    const prev = app.path;
    let mode = app.mode;
    if (!app.docOpen || !prev || isPlainText(prev) !== isPlainText(path)) mode = settings.defaultMode;
    // Visual (WYSIWYG) editing only exists for Markdown; other text opens in its source.
    if (isPlainText(path) && mode === 'visual') mode = 'source';
    addTab({ path, content: text, saved: text, mode }, true);
    if (!app.root) app.root = dirname(path);
    pushRecent(path);
  } catch (e) {
    toast(String(e) === 'binary' ? t('toast.binary', { name: basename(path) }) : t('toast.error', { msg: String(e) }));
  }
}

export async function openFolder(path?: string) {
  const dir = path ?? ((await open({ directory: true, multiple: false })) as string | null);
  if (!dir) return;
  app.root = dir;
  app.sidebar = true;
  app.sidebarTab = 'files';
  session.lastFolder = dir;
  app.treeVersion++;
}

export async function openFileDialog() {
  const p = await open({ multiple: true, filters: MD_FILTERS() });
  for (const f of Array.isArray(p) ? p : p ? [p] : []) await openPath(f);
}

export async function newDoc() {
  addTab({ path: null, content: '', saved: '', mode: settings.defaultMode === 'preview' ? 'source' : settings.defaultMode }, false);
}

export async function saveDoc(as = false): Promise<boolean> {
  let path = app.path;
  if (!path || as) {
    const chosen = await save({
      defaultPath: app.path ?? (app.root ? `${app.root}/${t('top.untitled')}.md` : `${t('top.untitled')}.md`),
      filters: MD_FILTERS(),
    });
    if (!chosen) return false;
    path = chosen;
  }
  const text = app.content;
  try {
    await invoke('write_text', { path, content: text });
    app.saved = text;
    if (path !== app.path) {
      app.path = path;
      pushRecent(path);
      await getCurrentWindow().setTitle(windowTitle()).catch(() => {});
      app.treeVersion++;
    }
    snapshot();
    persistTabs();
    rewatch();
    toast(t('toast.saved'), 1200);
    return true;
  } catch (e) {
    await message(String(e), { kind: 'error' });
    return false;
  }
}

/** Called when another program changes an open file. */
export async function onExternalChange(path: string) {
  const text = await invoke<string>('read_text', { path });
  if (path !== app.path) {
    // Background tab: follow the disk silently unless it has unsaved edits.
    const tb = app.tabs.find((x) => x.path === path);
    if (tb && tb.content === tb.saved) tb.content = tb.saved = text;
    return;
  }
  if (text === app.content || text === app.saved) return;
  if (isDirty()) {
    const reload = await ask(t('dlg.changedBody', { name: docName() }), {
      title: t('dlg.changedTitle'), kind: 'warning', okLabel: t('dlg.reload'), cancelLabel: t('dlg.keep'),
    });
    if (!reload) { app.saved = text; return; }
  }
  setContent(text);
  toast(t('toast.reloaded'), 1400);
}

/** Reopens the tabs of the previous session. */
export async function restoreTabs() {
  const last = session.lastFile;
  for (const p of session.tabs ?? []) {
    if ((await invoke<string>('path_kind', { path: p })) === 'file') await openPath(p, { fromHistory: true });
  }
  if (last && (await invoke<string>('path_kind', { path: last })) === 'file') await openPath(last, { fromHistory: true });
  nav.back = [];
}

export async function handleDroppedPaths(paths: string[]) {
  const dir = await firstOfKind(paths, 'dir');
  if (dir) await openFolder(dir);
  for (const file of paths.filter(isTextPath)) await openPath(file);
}

async function firstOfKind(paths: string[], kind: string) {
  for (const p of paths) if ((await invoke<string>('path_kind', { path: p })) === kind) return p;
  return null;
}

/** Toggles a "- [ ]" task on the given 1-based source line. */
export function toggleTaskLine(line: number) {
  const lines = app.content.split('\n');
  const i = line - 1;
  if (!lines[i]) return;
  const toggled = lines[i].replace(/\[( |x|X)\]/, (_m, c) => (c === ' ' ? '[x]' : '[ ]'));
  if (toggled === lines[i]) return;
  lines[i] = toggled;
  setContent(lines.join('\n'), false);
}

const TYPEWRITER_MODE = {
  theme: 'typewriter',
  typingSound: 'typewriter',
  typewriterScroll: true,
  typewriterOnlyZen: false,
  soundOnlyZen: false,
  paperTexture: true,
  inkVariation: true,
} as const;

export const typewriterModeOn = () => settings.typewriterPrev !== null;

/** One-click "Typewriter mode": theme, real key sounds, margin bell and centered caret; toggling restores the previous settings. */
export function toggleTypewriterMode() {
  if (settings.typewriterPrev) {
    Object.assign(settings, settings.typewriterPrev);
    settings.typewriterPrev = null;
    return;
  }
  const keys = Object.keys(TYPEWRITER_MODE) as (keyof typeof TYPEWRITER_MODE)[];
  settings.typewriterPrev = Object.fromEntries(keys.map((k) => [k, settings[k]]));
  Object.assign(settings, TYPEWRITER_MODE);
  if (settings.bellColumn <= 0) settings.bellColumn = 65;
  void preloadSounds();
}

export async function toggleZen() {
  app.zen = !app.zen;
  if (settings.zenFullscreen) {
    try { await getCurrentWindow().setFullscreen(app.zen); } catch {}
  }
}

export async function insertLink() {
  const sel = app.selection;
  const v = await askFields(t('link.title'), [
    { key: 'text', label: t('link.text'), value: sel },
    { key: 'url', label: t('link.url'), value: /^https?:\/\//.test(sel) ? sel : 'https://', placeholder: 'https://' },
  ]);
  if (v?.url) getEditorApi()?.exec({ type: 'link', url: v.url.trim(), text: v.text.trim() });
}

// ---- File operations from the tree

const under = (p: string, dir: string) => p === dir || p.startsWith(dir + '/') || p.startsWith(dir + '\\');

/** Points open tabs (and the active document) at a file or folder's new location. */
function retarget(from: string, to: string) {
  const move = (p: string | null) => (p && under(p, from) ? to + p.slice(from.length) : p);
  for (const tb of app.tabs) tb.path = move(tb.path);
  app.path = move(app.path);
  session.expanded = session.expanded.map((p) => move(p)!);
  persistTabs();
  rewatch();
}

/** Moves a file or folder into another folder (drag and drop in the tree). */
export async function movePath(from: string, toDir: string) {
  if (dirname(from) === toDir || under(toDir, from)) return;
  const to = join(toDir, basename(from));
  try {
    await invoke('rename_path', { from, to });
    retarget(from, to);
    app.treeVersion++;
  } catch (e) {
    toast(t(String(e) === 'exists' ? 'toast.exists' : 'toast.error', { msg: String(e), name: basename(from) }));
  }
}

/** Renames a file or folder in place, keeping open tabs pointed at it. */
export async function renamePath(from: string, name: string) {
  const to = join(dirname(from), name);
  try {
    await invoke('rename_path', { from, to });
    retarget(from, to);
    app.treeVersion++;
  } catch (e) {
    toast(t(String(e) === 'exists' ? 'toast.exists' : 'toast.error', { msg: String(e), name }));
  }
}

/** Moves a file or folder to the system trash after confirmation; closes its tabs. */
export async function trashPath(path: string) {
  const ok = await ask(t('dlg.trashBody', { name: basename(path) }), {
    title: t('dlg.trashTitle'), kind: 'warning', okLabel: t('dlg.trash'), cancelLabel: t('common.cancel'),
  });
  if (!ok) return;
  try {
    await invoke('trash_path', { path });
  } catch (e) {
    return toast(t('toast.error', { msg: String(e) }));
  }
  snapshot();
  for (let i = app.tabs.length - 1; i >= 0; i--) {
    const tb = app.tabs[i];
    if (!tb.path || !under(tb.path, path)) continue;
    tb.saved = tb.content; // the file is gone: nothing left to save over
    if (i === app.activeTab) app.saved = app.content;
    await closeTab(i);
  }
  app.treeVersion++;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
export const isImagePath = (p: string) => IMAGE_EXT.test(p);

/** Folder whose assets/ receives pasted or dropped images: the document's, else the open folder. */
function assetDir(): string | null {
  const dir = app.path ? dirname(app.path) : app.root;
  if (!dir) toast(t('toast.saveFirst'), 3500);
  return dir;
}

async function toBase64(file: Blob): Promise<string> {
  const url: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  return url.slice(url.indexOf(',') + 1);
}

/** Saves a pasted image into assets/ and returns its path relative to the document. */
export async function storeImage(file: File): Promise<string | null> {
  const dir = assetDir();
  if (!dir) return null;
  const ext = (file.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const name = file.name && !/^image\.\w+$/.test(file.name) ? file.name : `pasted-${stamp}.${ext}`;
  try {
    return await invoke<string>('save_asset', { dir, name, data: await toBase64(file) });
  } catch (e) {
    toast(t('toast.error', { msg: String(e) }));
    return null;
  }
}

/** Inserts pasted images at the cursor. */
export async function insertImageFiles(files: File[]) {
  for (const f of files) {
    const src = await storeImage(f);
    if (src) getEditorApi()?.exec({ type: 'image', src, alt: stem(src) });
  }
}

/** Copies image files dropped on the window into assets/ and links them at the cursor. */
export async function insertImagePaths(paths: string[]) {
  const dir = assetDir();
  if (!dir) return;
  for (const p of paths) {
    try {
      const src = await invoke<string>('copy_asset', { dir, src: p });
      getEditorApi()?.exec({ type: 'image', src, alt: stem(p) });
    } catch (e) {
      toast(t('toast.error', { msg: String(e) }));
    }
  }
}

export async function insertImage() {
  const p = await open({ multiple: false, filters: [{ name: t('dlg.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }] });
  if (typeof p !== 'string') return;
  const src = app.path ? relative(dirname(app.path), p) : p;
  getEditorApi()?.exec({ type: 'image', src, alt: stem(p) });
}
