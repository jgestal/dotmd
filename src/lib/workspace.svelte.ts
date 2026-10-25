// Workspace: several folders open at once in the sidebar, plus favourite documents pinned below them.
// Missing items (moved or deleted outside DotMD) are flagged so the user can locate or remove them.
import { invoke } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { app, session, pushRecentFolder, toast } from './state.svelte';
import { t } from './i18n';
import { basename } from './path';

/** Paths (folders or favourites) that no longer exist on disk. */
export const missing = $state<Record<string, boolean>>({});

const under = (p: string, dir: string) => p === dir || p.startsWith(dir + '/') || p.startsWith(dir + '\\');

export function workspaceFolders(): string[] {
  return session.folders ?? [];
}

/** Adds a folder to the sidebar (or brings it first) and makes it the active one. */
export function addFolder(dir: string) {
  const list = workspaceFolders().filter((f) => f !== dir);
  session.folders = [dir, ...list].slice(0, 8);
  app.root = dir;
  session.lastFolder = dir;
  pushRecentFolder(dir);
  delete missing[dir];
  app.treeVersion++;
}

export function removeFolder(dir: string) {
  session.folders = workspaceFolders().filter((f) => f !== dir);
  if (app.root === dir) app.root = session.folders[0] ?? null;
  session.lastFolder = app.root;
}

/** The workspace folder that contains `path`, if any (longest match wins for nested folders). */
export function folderOf(path: string): string | null {
  return workspaceFolders().filter((f) => under(path, f)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export const isFavorite = (path: string | null) => !!path && (session.favorites ?? []).includes(path);

export function toggleFavorite(path: string | null) {
  if (!path) return;
  const favs = session.favorites ?? [];
  session.favorites = favs.includes(path) ? favs.filter((f) => f !== path) : [...favs, path];
  delete missing[path];
}

export function removeFavorite(path: string) {
  session.favorites = (session.favorites ?? []).filter((f) => f !== path);
  delete missing[path];
}

/** Keeps favourites and folders pointing at items moved or renamed inside DotMD. */
export function retargetWorkspace(from: string, to: string) {
  const move = (p: string) => (under(p, from) ? to + p.slice(from.length) : p);
  session.favorites = (session.favorites ?? []).map(move);
  session.folders = workspaceFolders().map(move);
}

/** Re-checks every favourite and folder; returns how many are missing. */
export async function checkMissing(): Promise<number> {
  const items = [...workspaceFolders().map((p) => [p, 'dir'] as const), ...(session.favorites ?? []).map((p) => [p, 'file'] as const)];
  let count = 0;
  await Promise.all(
    items.map(async ([p, want]) => {
      const kind = await invoke<string>('path_kind', { path: p }).catch(() => 'missing');
      const gone = kind !== want;
      if (gone) { missing[p] = true; count++; } else delete missing[p];
    }),
  );
  return count;
}

/** On start: warn once if favourites or folders have disappeared. */
export async function warnAboutMissing() {
  const n = await checkMissing();
  if (n) toast(t('fav.missingToast', { n }), 6000);
}

/** A missing item was clicked: find where it went, or forget it. */
export async function resolveMissing(path: string, isFolder: boolean) {
  const locate = await ask(t(isFolder ? 'fav.missingFolderBody' : 'fav.missingBody', { name: basename(path), path }), {
    title: t('fav.missingTitle'), kind: 'warning', okLabel: t('fav.locate'), cancelLabel: t('fav.remove'),
  });
  if (!locate) return isFolder ? removeFolder(path) : removeFavorite(path);
  const found = await open({ directory: isFolder, multiple: false, defaultPath: path.replace(/[\\/][^\\/]*$/, '') });
  if (typeof found !== 'string') return;
  if (isFolder) session.folders = workspaceFolders().map((f) => (f === path ? found : f));
  else session.favorites = (session.favorites ?? []).map((f) => (f === path ? found : f));
  delete missing[path];
  app.treeVersion++;
}
