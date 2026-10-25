// Use cases for file operations from the sidebar and the editor: move, rename, trash, new file,
// images pasted or dropped into a document.
import type { Services } from '../ports';
import { toAppError, errorMessage } from '../domain/errors';
import { isUnder } from '../domain/documents';
import type { Documents } from './documents';
import type { Workspace } from './workspace';

export interface FilesDeps {
  services: Services;
  documents: Documents;
  workspace: Workspace;
  state: { path: string | null; root: string | null; treeVersion: number };
  session: { expanded: string[] };
  join(dir: string, name: string): string;
  dirname(path: string): string;
  basename(path: string): string;
}

export function createFiles(d: FilesDeps) {
  const { services: s, documents, workspace, state, session } = d;

  function report(e: unknown, name: string) {
    const { key, vars } = errorMessage(toAppError(e), name);
    s.notify.error(s.t(key, vars), 5000);
  }

  /** Everything that refers to a path follows it to its new place. */
  function followMove(from: string, to: string) {
    documents.retarget(from, to);
    workspace.retarget(from, to);
    session.expanded = session.expanded.map((p) => (isUnder(p, from) ? to + p.slice(from.length) : p));
    state.treeVersion++;
  }

  async function rename(from: string, to: string, shownName: string): Promise<boolean> {
    try {
      await s.fs.rename(from, to);
    } catch (e) {
      report(e, shownName);
      return false;
    }
    followMove(from, to);
    return true;
  }

  return {
    /** Moves a file or folder into another folder (drag and drop in the tree). */
    async move(from: string, toDir: string) {
      if (d.dirname(from) === toDir || isUnder(toDir, from)) return false;
      return rename(from, d.join(toDir, d.basename(from)), d.basename(from));
    },
    /** Renames in place, keeping tabs and favourites pointed at it. */
    renameTo(from: string, name: string) {
      return rename(from, d.join(d.dirname(from), name), name);
    },
    /** Moves to the system trash after confirmation; closes its tabs without asking to save. */
    async trash(path: string) {
      const ok = await s.dialogs.confirm({
        title: s.t('dlg.trashTitle'), message: s.t('dlg.trashBody', { name: d.basename(path) }), ok: s.t('dlg.trash'), cancel: s.t('common.cancel'),
      });
      if (!ok) return false;
      try {
        await s.fs.trash(path);
      } catch (e) {
        report(e, d.basename(path));
        return false;
      }
      await documents.forgetWhere((p) => isUnder(p, path));
      state.treeVersion++;
      return true;
    },
    async createIn(dir: string, name: string) {
      const file = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.md`;
      const path = d.join(dir, file);
      try {
        await s.fs.createFile(path);
      } catch (e) {
        report(e, file);
        return null;
      }
      state.treeVersion++;
      await documents.openPath(path);
      return path;
    },
    /** Folder whose assets/ receives images: the document's, else the active workspace folder. */
    assetDir(): string | null {
      const dir = state.path ? d.dirname(state.path) : state.root;
      if (!dir) s.notify.info(s.t('toast.saveFirst'), 3500);
      return dir;
    },
    async saveImage(name: string, base64: string): Promise<string | null> {
      const dir = this.assetDir();
      if (!dir) return null;
      try {
        return await s.fs.saveAsset(dir, name, base64);
      } catch (e) {
        report(e, name);
        return null;
      }
    },
    async copyImages(paths: string[]): Promise<string[]> {
      const dir = this.assetDir();
      if (!dir) return [];
      const out: string[] = [];
      for (const p of paths) {
        try { out.push(await s.fs.copyAsset(dir, p)); } catch (e) { report(e, d.basename(p)); }
      }
      return out;
    },
  };
}

export type Files = ReturnType<typeof createFiles>;
