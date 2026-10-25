// Presentation controller: what buttons, menus and shortcuts call. Document, workspace and file
// rules live in application/ (wired in container.ts); this module adds the UI-only behaviour
// (zen, typewriter mode, editor insertions, clipboard) and re-exports a stable API for components.
import { app, settings, getEditorApi } from './state.svelte';
import { askFields } from './prompt.svelte';
import { preloadSounds } from './sound';
import { t } from './i18n';
import { dirname, relative, stem } from './path';
import { documents, files, services, workspace } from './container';

export const {
  docName, windowTitle, activateTab, openPath, closeTab, closeOtherTabs, closeTabsToRight, closeTabsToLeft,
  cycleTab, moveTab, anyDirty, confirmCloseAll, confirmDiscard, canGoBack, canGoForward, goBack, goForward,
  onExternalChange, handleDroppedPaths, toggleTaskLine, newDoc, openFileDialog,
} = documents;
export { APP_TITLE } from './application/documents';

export const saveDoc = (as = false) => documents.save(as);
export const restoreTabs = () => documents.restore();

/** Adds a folder to the sidebar workspace (several can be open at once); asks when none is given. */
export async function openFolder(path?: string) {
  const dir = path ?? (await services.dialogs.pickFolder());
  if (!dir) return;
  workspace.addFolder(dir);
  app.sidebar = true;
  app.sidebarTab = 'files';
}

export const movePath = (from: string, toDir: string) => files.move(from, toDir);
export const renamePath = (from: string, name: string) => files.renameTo(from, name);
export const trashPath = (path: string) => files.trash(path);

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

/** Focus highlight on/off in any mode (not only zen), keeping the chosen focus style. */
export function toggleFocusHighlight() {
  const on = settings.focusMode !== 'off' && !settings.focusOnlyZen;
  if (on) settings.focusOnlyZen = true;
  else {
    if (settings.focusMode === 'off') settings.focusMode = 'line';
    settings.focusOnlyZen = false;
  }
}

export async function toggleZen() {
  app.zen = !app.zen;
  if (!app.zen) app.focusWriting = false;
  if (settings.zenFullscreen) {
    await services.window.setFullscreen(app.zen);
  }
}

/**
 * Focus writing: full screen, everything but the line being written dimmed, caret kept centered.
 * Switches a read-only view to the editor first.
 */
export async function toggleFocusWriting() {
  if (app.zen) return toggleZen();
  if (!app.docOpen) await newDoc();
  if (app.mode === 'preview' || app.mode === 'split') app.mode = 'source';
  app.focusWriting = true;
  await toggleZen();
  requestAnimationFrame(() => getEditorApi()?.focus());
}

/** Copies the selection (or the whole document) as formatted text, for Gmail, Docs, Word… */
export async function copyRichText() {
  const { richHtml } = await import('./export');
  const { currentTheme } = await import('./appearance.svelte');
  const { THEMES } = await import('./themes');
  const md = app.selection || app.content;
  // Light colours always: the paste target has a white background.
  const html = await richHtml(md, app.path, currentTheme().dark ? THEMES[0] : currentTheme());
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([md], { type: 'text/plain' }) }),
    ]);
    services.notify.info(t('toast.copiedRich'), 1500);
  } catch (e) {
    documents.report(e);
  }
}

/** Inserts a link (or the image) to another file at the cursor: dragging a tree row into the editor. */
export function insertFileLink(path: string) {
  const api = getEditorApi();
  if (!api) return;
  const src = app.path ? relative(dirname(app.path), path) : path;
  if (isImagePath(path)) api.exec({ type: 'image', src, alt: stem(path) });
  else api.exec({ type: 'link', url: encodeURI(src), text: stem(path) });
}

/** Inserts a table of contents at the top, or refreshes the existing one. */
export async function updateToc() {
  const { applyToc } = await import('./toc');
  const next = applyToc(app.content);
  if (next !== app.content) documents.replaceContent(next, false);
}

export async function insertLink() {
  const sel = app.selection;
  const v = await askFields(t('link.title'), [
    { key: 'text', label: t('link.text'), value: sel },
    { key: 'url', label: t('link.url'), value: /^https?:\/\//.test(sel) ? sel : 'https://', placeholder: 'https://' },
  ]);
  if (v?.url) getEditorApi()?.exec({ type: 'link', url: v.url.trim(), text: v.text.trim() });
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
export const isImagePath = (p: string) => IMAGE_EXT.test(p);

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
  const ext = (file.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const name = file.name && !/^image\.\w+$/.test(file.name) ? file.name : `pasted-${stamp}.${ext}`;
  return files.saveImage(name, await toBase64(file));
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
  const srcs = await files.copyImages(paths);
  srcs.forEach((src, i) => getEditorApi()?.exec({ type: 'image', src, alt: stem(paths[i]) }));
}

export async function insertImage() {
  const [p] = await services.dialogs.pickFiles({ filters: [{ name: t('dlg.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'] }] });
  if (!p) return;
  const src = app.path ? relative(dirname(app.path), p) : p;
  getEditorApi()?.exec({ type: 'image', src, alt: stem(p) });
}
