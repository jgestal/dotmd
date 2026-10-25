// Pure workspace rules: the folders open in the sidebar and the favourite documents.
import { isUnder, retargetPath } from './documents';

export const MAX_FOLDERS = 8;

/** Brings `dir` first (adding it if new), keeping at most MAX_FOLDERS. */
export function withFolder(folders: string[], dir: string): string[] {
  return [dir, ...folders.filter((f) => f !== dir)].slice(0, MAX_FOLDERS);
}

export const withoutFolder = (folders: string[], dir: string) => folders.filter((f) => f !== dir);

/** The folder containing `path`; the deepest one wins when folders are nested. */
export function owningFolder(folders: string[], path: string): string | null {
  return folders.filter((f) => isUnder(path, f)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export const toggled = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export const retargetAll = (list: string[], from: string, to: string) => list.map((p) => retargetPath(p, from, to));

export const replaced = (list: string[], from: string, to: string) => list.map((p) => (p === from ? to : p));

/** Most-recent-first list without duplicates. */
export function pushRecent(list: string[], item: string, max: number): string[] {
  return [item, ...list.filter((p) => p !== item)].slice(0, max);
}

export type TreeSort = 'name' | 'modified';

/** Folders first, then by name (natural order) or by last modification, newest first. */
export function sortEntries<T extends { name: string; is_dir: boolean; modified?: number }>(entries: T[], by: TreeSort): T[] {
  const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return [...entries].sort((a, b) =>
    Number(b.is_dir) - Number(a.is_dir)
    || (by === 'modified' ? (b.modified ?? 0) - (a.modified ?? 0) : 0)
    || byName.compare(a.name, b.name));
}
