// Tauri adapters: the real implementations of the ports (Rust commands and plugins).
import { invoke } from '@tauri-apps/api/core';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppWindow, Dialogs, DirEntry, FileSystem, FileWatcher, PathKind } from '../../ports';
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
};

export const tauriWatcher: FileWatcher = {
  watch: (paths) => invoke<void>('watch_files', { paths }).catch(() => {}),
};
