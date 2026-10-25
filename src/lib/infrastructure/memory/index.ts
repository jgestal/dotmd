// In-memory adapters: test doubles for every port, with scripted answers and call records.
import type { AppWindow, ConfirmOptions, Dialogs, DirEntry, FileSystem, FileWatcher, Notifier, PathKind, Services, Translate } from '../../ports';
import { AppError } from '../../domain/errors';

const parent = (p: string) => p.slice(0, Math.max(0, p.lastIndexOf('/'))) || '/';
const name = (p: string) => p.slice(p.lastIndexOf('/') + 1);

/** A POSIX-like file tree in a Map; folders are implied by file paths or created explicitly. */
export class MemoryFileSystem implements FileSystem {
  files = new Map<string, string>();
  dirs = new Set<string>();
  trashed: string[] = [];

  constructor(initial: Record<string, string> = {}) {
    for (const [p, c] of Object.entries(initial)) this.put(p, c);
  }
  put(path: string, content: string) {
    this.files.set(path, content);
    for (let d = parent(path); d !== '/' && !this.dirs.has(d); d = parent(d)) this.dirs.add(d);
  }
  async kind(path: string): Promise<PathKind> {
    return this.files.has(path) ? 'file' : this.dirs.has(path) ? 'dir' : 'missing';
  }
  async readText(path: string) {
    const c = this.files.get(path);
    if (c === undefined) throw new AppError('not-found', `no such file: ${path}`, path);
    if (c.includes('\0')) throw new AppError('binary', 'binary', path);
    return c;
  }
  async writeText(path: string, content: string) { this.put(path, content); }
  async listDir(path: string): Promise<DirEntry[]> {
    const kids = new Map<string, boolean>();
    for (const p of [...this.files.keys(), ...this.dirs]) if (parent(p) === path) kids.set(p, this.dirs.has(p));
    return [...kids].map(([p, d]) => ({ name: name(p), path: p, is_dir: d })).sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name));
  }
  async listTree(path: string) {
    return [...this.files.keys()].filter((p) => p.startsWith(path + '/')).sort();
  }
  async rename(from: string, to: string) {
    if (this.files.has(to) || this.dirs.has(to)) throw new AppError('exists', 'exists', to);
    for (const [p, c] of [...this.files]) {
      if (p === from || p.startsWith(from + '/')) { this.files.delete(p); this.put(to + p.slice(from.length), c); }
    }
    if (this.dirs.delete(from)) this.dirs.add(to);
  }
  async createFile(path: string) {
    if (this.files.has(path)) throw new AppError('exists', 'exists', path);
    this.put(path, '');
  }
  async trash(path: string) {
    this.trashed.push(path);
    for (const p of [...this.files.keys()]) if (p === path || p.startsWith(path + '/')) this.files.delete(p);
    this.dirs.delete(path);
  }
  async saveAsset(dir: string, file: string, base64: string) {
    this.put(`${dir}/assets/${file}`, atob(base64));
    return `assets/${file}`;
  }
  async copyAsset(dir: string, src: string) {
    this.put(`${dir}/assets/${name(src)}`, this.files.get(src) ?? '');
    return `assets/${name(src)}`;
  }
}

/** Dialogs that answer from queues; unscripted confirms say "cancel" and pickers return nothing. */
export class ScriptedDialogs implements Dialogs {
  confirms: boolean[] = [];
  files: string[][] = [];
  folders: (string | null)[] = [];
  saves: (string | null)[] = [];
  asked: ConfirmOptions[] = [];
  alerts: string[] = [];
  async confirm(o: ConfirmOptions) { this.asked.push(o); return this.confirms.shift() ?? false; }
  async pickFiles() { return this.files.shift() ?? []; }
  async pickFolder() { return this.folders.shift() ?? null; }
  async saveFile() { return this.saves.shift() ?? null; }
  async alert(m: string) { this.alerts.push(m); }
}

export class RecordingWindow implements AppWindow {
  titles: string[] = [];
  fullscreen = false;
  async setTitle(t: string) { this.titles.push(t); }
  async setFullscreen(on: boolean) { this.fullscreen = on; }
  document: { path: string | null; edited: boolean } = { path: null, edited: false };
  draggedOut: string[][] = [];
  async setDocument(path: string | null, edited: boolean) { this.document = { path, edited }; }
  async dragOut(paths: string[]) { this.draggedOut.push(paths); }
  get title() { return this.titles.at(-1); }
}

export class RecordingWatcher implements FileWatcher {
  watched: string[] = [];
  async watch(paths: string[]) { this.watched = [...paths]; }
}

export class RecordingNotifier implements Notifier {
  infos: string[] = [];
  errors: string[] = [];
  info(m: string) { this.infos.push(m); }
  error(m: string) { this.errors.push(m); }
}

/** Returns the key and its variables, so tests can assert on messages without translations. */
export const keyTranslate: Translate = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

export function memoryServices(files: Record<string, string> = {}) {
  const s = {
    fs: new MemoryFileSystem(files),
    dialogs: new ScriptedDialogs(),
    window: new RecordingWindow(),
    watcher: new RecordingWatcher(),
    notify: new RecordingNotifier(),
    t: keyTranslate,
  };
  return s satisfies Services;
}
