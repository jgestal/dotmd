// Tauri adapters: the real implementations of the ports (Rust commands and plugins).
import { invoke, Channel } from '@tauri-apps/api/core';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import type { AppProcess, AppWindow, Dialogs, DirEntry, Exporter, FileSystem, FileWatcher, FuzzyHit, MarkdownEngine, PathKind, SearchEngine, SearchEvent } from '../../ports';
import { toAppError } from '../../domain/errors';

/** Runs a Rust command, turning its string errors into AppErrors. */
async function call<T>(cmd: string, args: Record<string, unknown>, path?: string): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e, path);
  }
}

export const tauriFileSystem: FileSystem = {
  kind: (path) => call<PathKind>('path_kind', { path }, path).catch(() => 'missing' as const),
  readText: (path) => call<string>('read_text', { path }, path),
  writeText: (path, content) => call<void>('write_text', { path, content }, path),
  listDir: (path, all) => call<DirEntry[]>('list_dir', { path, all }, path),
  listTree: (path) => call<string[]>('list_tree', { path }, path),
  rename: (from, to) => call<void>('rename_path', { from, to }, from),
  createFile: (path) => call<void>('create_file', { path }, path),
  trash: (path) => call<void>('trash_path', { path }, path),
  saveAsset: (dir, name, data) => call<string>('save_asset', { dir, name, data }, dir),
  copyAsset: (dir, src) => call<string>('copy_asset', { dir, src }, src),
};

export const tauriDialogs: Dialogs = {
  confirm: (o) => ask(o.message, { title: o.title, kind: o.kind ?? 'warning', okLabel: o.ok, cancelLabel: o.cancel }),
  async pickFiles(o) {
    const r = await open({ multiple: o.multiple ?? false, filters: o.filters, defaultPath: o.defaultPath });
    return Array.isArray(r) ? r : r ? [r] : [];
  },
  async pickFolder(o) {
    const r = await open({ directory: true, multiple: false, defaultPath: o?.defaultPath });
    return typeof r === 'string' ? r : null;
  },
  saveFile: (o) => save({ defaultPath: o.defaultPath, filters: o.filters }),
  alert: (msg, kind = 'error') => message(msg, { kind }).then(() => {}),
};

export const tauriWindow: AppWindow = {
  setTitle: (title) => getCurrentWindow().setTitle(title).catch(() => {}),
  setFullscreen: (on) => getCurrentWindow().setFullscreen(on).catch(() => {}),
  setDocument: (path, edited) => invoke<void>('set_document', { path, edited }).catch(() => {}),
  async dragOut(paths) {
    const icon = await call<string>('drag_icon', {});
    await startDrag({ item: paths, icon });
  },
};

export const tauriWatcher: FileWatcher = {
  watch: (paths) => invoke<void>('watch_files', { paths }).catch(() => {}),
};

export const tauriMarkdown: MarkdownEngine = {
  toHtml: (text) => call<string>('render_markdown', { text }),
};

export const tauriExporter: Exporter = {
  writeHtml: (path, html) => call<void>('write_export', { path, html }, path),
  printPdfNative: (html, out, pageSize, marginMm) => call<void>('export_pdf_native', { html, out, pageSize, marginMm }, out),
  printPdfChromium: (html, out) => call<void>('export_pdf', { html, out }, out),
  pdfEngineName: () => call<string | null>('pdf_engine', {}),
  imageDataUrl: (path) => call<string>('read_data_url', { path }, path),
};

export const tauriSearch: SearchEngine = {
  fuzzyFind: (root, query, limit) => call<FuzzyHit[]>('fuzzy_find', { root, query, limit }, root),
  async searchFolders(roots, query, o, onEvent) {
    const ch = new Channel<SearchEvent>();
    ch.onmessage = onEvent;
    await call<void>('search_folder', { roots, query, regex: o.regex, caseSensitive: o.caseSensitive, onEvent: ch });
  },
};

export const tauriProcess: AppProcess = {
  takePendingOpen: () => call<string[]>('take_pending_open', {}),
  takeCliExport: <T>() => call<T | null>('take_cli_export', {}),
  quit: (code) => call<void>('quit', { code }),
  installCli: () => call<string>('install_cli', {}),
};
