// Ports: what the application layer needs from the outside world, as interfaces.
// Infrastructure implements them (infrastructure/tauri for the app, infrastructure/memory for
// tests); the domain and application layers never import Tauri, Svelte or the DOM.

export type PathKind = 'file' | 'dir' | 'missing';

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

/** Files on disk. Errors are AppError (see domain/errors.ts). */
export interface FileSystem {
  kind(path: string): Promise<PathKind>;
  readText(path: string): Promise<string>;
  writeText(path: string, content: string): Promise<void>;
  listDir(path: string, includeAll: boolean): Promise<DirEntry[]>;
  listTree(path: string): Promise<string[]>;
  rename(from: string, to: string): Promise<void>;
  createFile(path: string): Promise<void>;
  trash(path: string): Promise<void>;
  /** Saves base64 image data as assets/<name> under dir; returns the relative path. */
  saveAsset(dir: string, name: string, base64: string): Promise<string>;
  copyAsset(dir: string, src: string): Promise<string>;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConfirmOptions {
  title: string;
  message: string;
  ok: string;
  cancel: string;
  kind?: 'info' | 'warning' | 'error';
}

/** Native dialogs. */
export interface Dialogs {
  /** true = OK button. */
  confirm(o: ConfirmOptions): Promise<boolean>;
  pickFiles(o: { multiple?: boolean; filters?: FileFilter[]; defaultPath?: string }): Promise<string[]>;
  pickFolder(o?: { defaultPath?: string }): Promise<string | null>;
  saveFile(o: { defaultPath?: string; filters?: FileFilter[] }): Promise<string | null>;
  alert(message: string, kind?: 'info' | 'warning' | 'error'): Promise<void>;
}

export interface AppWindow {
  setTitle(title: string): Promise<void>;
  setFullscreen(on: boolean): Promise<void>;
}

/** Re-arms change notifications for the given files (live reload). */
export interface FileWatcher {
  watch(paths: string[]): Promise<void>;
}

/** Short, non-blocking messages to the user. */
export interface Notifier {
  info(message: string, ms?: number): void;
  error(message: string, ms?: number): void;
}

/** Localised strings (presentation provides the implementation). */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Everything the use cases depend on, injected at the composition root. */
export interface Services {
  fs: FileSystem;
  dialogs: Dialogs;
  window: AppWindow;
  watcher: FileWatcher;
  notify: Notifier;
  t: Translate;
}
