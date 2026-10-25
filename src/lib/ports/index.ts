// Ports: what the application layer needs from the outside world, as interfaces.
// Infrastructure implements them (infrastructure/tauri for the app, infrastructure/memory for
// tests); the domain and application layers never import Tauri, Svelte or the DOM.

export type PathKind = 'file' | 'dir' | 'missing';

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  /** Last modification (ms since epoch), when known. */
  modified?: number;
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
  /** The file the window shows and whether it has unsaved changes (macOS close-button dot). */
  setDocument(path: string | null, edited: boolean): Promise<void>;
  /** Starts a native drag of files out of the app (to Finder, mail, other apps). */
  dragOut(paths: string[]): Promise<void>;
}

/** Re-arms change notifications for the given files (live reload). */
export interface FileWatcher {
  watch(paths: string[]): Promise<void>;
}

/** Markdown → HTML (comrak in Rust). */
export interface MarkdownEngine {
  toHtml(markdown: string): Promise<string>;
}

/** Writing exported documents and printing PDFs. */
export interface Exporter {
  writeHtml(path: string, html: string): Promise<void>;
  /** System WebKit (macOS, Linux); rejects with AppError 'no-engine' where unsupported. */
  printPdfNative(html: string, out: string, pageSize: string, marginMm: number): Promise<void>;
  /** Headless Chromium; rejects with AppError 'no-engine' when no browser is installed. */
  printPdfChromium(html: string, out: string): Promise<void>;
  pdfEngineName(): Promise<string | null>;
  /** An image as a data: URL, so exported HTML is self-contained. */
  imageDataUrl(path: string): Promise<string>;
}

export interface FuzzyHit { path: string; rel: string; score: number; indices: number[] }
export interface LineHit { line: number; text: string; ranges: [number, number][] }
export type SearchEvent =
  | { kind: 'file'; path: string; rel: string; matches: LineHit[] }
  | { kind: 'done'; files: number; matches: number; truncated: boolean };

export interface SearchEngine {
  fuzzyFind(root: string, query: string, limit: number): Promise<FuzzyHit[]>;
  /** Streams results; a newer search cancels an older one. */
  searchFolders(roots: string[], query: string, o: { regex: boolean; caseSensitive: boolean }, onEvent: (e: SearchEvent) => void): Promise<void>;
}

/** The app process: launch arguments, quitting, the command-line tool. */
export interface AppProcess {
  takePendingOpen(): Promise<string[]>;
  takeCliExport<T>(): Promise<T | null>;
  quit(code: number): Promise<void>;
  installCli(): Promise<string>;
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

/** Ports used by presentation-level modules (rendering, export, search, launch). */
export interface PlatformServices extends Services {
  markdown: MarkdownEngine;
  exporter: Exporter;
  search: SearchEngine;
  process: AppProcess;
}
