// Use cases for the sidebar workspace: folders, favourites and missing items.
import type { Services } from '../ports';
import { isUnder } from '../domain/documents';
import { owningFolder, pushRecent, replaced, retargetAll, toggled, withFolder, withoutFolder } from '../domain/workspace';

export interface WorkspaceSession {
  folders: string[];
  favorites: string[];
  recentFolders: string[];
  lastFolder: string | null;
}

export interface WorkspaceState {
  root: string | null;
  treeVersion: number;
}

export interface WorkspaceDeps {
  services: Services;
  session: WorkspaceSession;
  state: WorkspaceState;
  /** Paths that no longer exist on disk (observable in the app). */
  missing: Record<string, boolean>;
  basename(path: string): string;
  dirname(path: string): string;
}

export function createWorkspace(d: WorkspaceDeps) {
  const { services: s, session, state, missing } = d;
  const folders = () => session.folders ?? [];
  const favorites = () => session.favorites ?? [];

  function addFolder(dir: string) {
    session.folders = withFolder(folders(), dir);
    state.root = dir;
    session.lastFolder = dir;
    session.recentFolders = pushRecent(session.recentFolders ?? [], dir, 10);
    delete missing[dir];
    state.treeVersion++;
  }

  function removeFolder(dir: string) {
    session.folders = withoutFolder(folders(), dir);
    if (state.root === dir) state.root = session.folders[0] ?? null;
    session.lastFolder = state.root;
  }

  function removeFavorite(path: string) {
    session.favorites = favorites().filter((f) => f !== path);
    delete missing[path];
  }

  /** Re-checks every folder and favourite; returns how many are missing. */
  async function checkMissing(): Promise<number> {
    const items = [...folders().map((p) => [p, 'dir'] as const), ...favorites().map((p) => [p, 'file'] as const)];
    const kinds = await Promise.all(items.map(([p]) => s.fs.kind(p)));
    let count = 0;
    items.forEach(([p, want], i) => {
      if (kinds[i] !== want) { missing[p] = true; count++; } else delete missing[p];
    });
    return count;
  }

  return {
    folders,
    favorites,
    addFolder,
    removeFolder,
    removeFavorite,
    checkMissing,
    folderOf: (path: string) => owningFolder(folders(), path),
    isFavorite: (path: string | null) => !!path && favorites().includes(path),
    toggleFavorite(path: string | null) {
      if (!path) return;
      session.favorites = toggled(favorites(), path);
      delete missing[path];
    },
    /** Opening a file makes its folder active; a lone file opens its folder. */
    revealFolderOf(path: string) {
      const owner = owningFolder(folders(), path);
      if (owner) state.root = owner;
      else if (!folders().length) addFolder(d.dirname(path));
    },
    async pickFolder() {
      const dir = await s.dialogs.pickFolder();
      if (dir) addFolder(dir);
      return dir;
    },
    /** Keeps favourites and folders pointing at items moved or renamed inside DotMD. */
    retarget(from: string, to: string) {
      session.favorites = retargetAll(favorites(), from, to);
      session.folders = retargetAll(folders(), from, to);
    },
    isUnderWorkspace: (p: string) => folders().some((f) => isUnder(p, f)),
    async warnAboutMissing() {
      const n = await checkMissing();
      if (n) s.notify.info(s.t('fav.missingToast', { n }), 6000);
      return n;
    },
    /** A missing item was clicked: locate where it went, or forget it. */
    async resolveMissing(path: string, isFolder: boolean) {
      const locate = await s.dialogs.confirm({
        title: s.t('fav.missingTitle'),
        message: s.t(isFolder ? 'fav.missingFolderBody' : 'fav.missingBody', { name: d.basename(path), path }),
        ok: s.t('fav.locate'), cancel: s.t('fav.remove'),
      });
      if (!locate) return isFolder ? removeFolder(path) : removeFavorite(path);
      const found = isFolder
        ? await s.dialogs.pickFolder({ defaultPath: d.dirname(path) })
        : (await s.dialogs.pickFiles({ defaultPath: d.dirname(path) }))[0] ?? null;
      if (!found) return;
      if (isFolder) session.folders = replaced(folders(), path, found);
      else session.favorites = replaced(favorites(), path, found);
      delete missing[path];
      state.treeVersion++;
    },
  };
}

export type Workspace = ReturnType<typeof createWorkspace>;
