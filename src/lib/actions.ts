import { invoke } from '@tauri-apps/api/core';
import { open, save, ask, message } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { app, isDirty, session, settings, setContent, pushRecent, toast, getEditorApi } from './state.svelte';
import { askFields } from './prompt.svelte';
import { preloadSounds } from './sound';
import { t } from './i18n';
import { basename, dirname, isMarkdown, isPlainText, relative, stem } from './path';

const MD_FILTERS = () => [
  { name: t('dlg.markdown'), extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: t('dlg.text'), extensions: ['txt', 'text'] },
];

export function docName(): string {
  return app.path ? basename(app.path) : t('top.untitled');
}

/** Asks what to do with unsaved changes. Returns false if the user cancelled. */
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

export async function openPath(path: string, opts: { skipConfirm?: boolean } = {}) {
  const kind = await invoke<string>('path_kind', { path });
  if (kind === 'dir') return openFolder(path);
  if (kind !== 'file') return;
  if (path === app.path) return;
  if (!opts.skipConfirm && !(await confirmDiscard())) return;
  try {
    const text = await invoke<string>('read_text', { path });
    const prev = app.path;
    app.path = path;
    app.docOpen = true;
    setContent(text);
    app.sessionStartWords = -1;
    if (isPlainText(path)) {
      if (app.mode === 'preview' || app.mode === 'visual') app.mode = 'source';
    } else if (!prev || isPlainText(prev)) {
      app.mode = settings.defaultMode;
    }
    if (!app.root) app.root = dirname(path);
    session.lastFile = path;
    pushRecent(path);
    await invoke('watch_file', { path });
    await getCurrentWindow().setTitle(basename(path));
  } catch (e) {
    toast(t('toast.error', { msg: String(e) }));
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
  const p = await open({ multiple: false, filters: MD_FILTERS() });
  if (typeof p === 'string') await openPath(p);
}

export async function newDoc() {
  if (!(await confirmDiscard())) return;
  app.path = null;
  app.docOpen = true;
  setContent('');
  app.mode = settings.defaultMode === 'preview' ? 'source' : settings.defaultMode;
  await invoke('watch_file', { path: null });
  await getCurrentWindow().setTitle(t('top.untitled'));
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
      session.lastFile = path;
      await invoke('watch_file', { path });
      await getCurrentWindow().setTitle(basename(path));
      app.treeVersion++;
    }
    toast(t('toast.saved'), 1200);
    return true;
  } catch (e) {
    await message(String(e), { kind: 'error' });
    return false;
  }
}

/** Called when another program changes the open file. */
export async function onExternalChange(path: string) {
  if (path !== app.path) return;
  const text = await invoke<string>('read_text', { path });
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

export async function handleDroppedPaths(paths: string[]) {
  const dir = await firstOfKind(paths, 'dir');
  if (dir) await openFolder(dir);
  const file = paths.find((p) => isMarkdown(p) || isPlainText(p));
  if (file) await openPath(file);
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

export async function insertImage() {
  const p = await open({ multiple: false, filters: [{ name: t('dlg.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }] });
  if (typeof p !== 'string') return;
  const src = app.path ? relative(dirname(app.path), p) : p;
  getEditorApi()?.exec({ type: 'image', src, alt: stem(p) });
}
