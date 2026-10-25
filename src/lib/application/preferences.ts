// Use cases for preferences: export to / import from a file, and keep them in a synced folder.
import type { FileFilter, Services } from '../ports';
import { toAppError } from '../domain/errors';
import { PREFS_FILE, parsePrefs, portable, serializePrefs, syncedIsNewer } from '../domain/preferences';

export interface PreferencesDeps<S extends object> {
  services: Services;
  settings: S & { syncFolder: string | null };
  defaults: S;
  /** When this machine last wrote or read the synced file, and what it contained. */
  syncState: { lastSync: string | null; lastBody?: string | null };
  join(dir: string, name: string): string;
  now?: () => Date;
}

export function createPreferences<S extends object>(d: PreferencesDeps<S>) {
  const { services: s, settings, defaults, syncState } = d;
  const now = d.now ?? (() => new Date());
  const filters: FileFilter[] = [{ name: 'DotMD preferences', extensions: ['json'] }];
  const body = () => JSON.stringify(portable(settings));
  const syncPath = () => (settings.syncFolder ? d.join(settings.syncFolder, PREFS_FILE) : null);

  function fail(e: unknown) {
    const err = toAppError(e);
    s.notify.error(err.code === 'invalid' ? s.t('prefs.invalid') : s.t('toast.error', { msg: err.message }), 5000);
  }

  function apply(text: string): boolean {
    const { settings: incoming, ignored } = parsePrefs(text, defaults);
    Object.assign(settings, incoming);
    if (ignored.length) console.warn('preferences: ignored', ignored.join(', '));
    return true;
  }

  async function exportTo(): Promise<boolean> {
    const out = await s.dialogs.saveFile({ defaultPath: PREFS_FILE, filters });
    if (!out) return false;
    try {
      await s.fs.writeText(out, serializePrefs(settings, now()));
      s.notify.info(s.t('prefs.exported'));
      return true;
    } catch (e) { fail(e); return false; }
  }

  async function importFrom(): Promise<boolean> {
    const [file] = await s.dialogs.pickFiles({ filters });
    if (!file) return false;
    try {
      apply(await s.fs.readText(file));
      s.notify.info(s.t('prefs.imported'));
      return true;
    } catch (e) { fail(e); return false; }
  }

  /** Writes the settings to the synced folder when they changed since the last sync. */
  async function push(): Promise<boolean> {
    const path = syncPath();
    if (!path || body() === syncState.lastBody) return false;
    try {
      const at = now();
      await s.fs.writeText(path, serializePrefs(settings, at));
      syncState.lastSync = at.toISOString();
      syncState.lastBody = body();
      return true;
    } catch (e) { fail(e); return false; }
  }

  /** Loads the synced file when another machine saved it after our last sync. True if applied. */
  async function pull(): Promise<boolean> {
    const path = syncPath();
    if (!path || (await s.fs.kind(path)) !== 'file') return false;
    try {
      const text = await s.fs.readText(path);
      const { savedAt } = parsePrefs(text, defaults);
      if (!syncedIsNewer(savedAt, syncState.lastSync)) return false;
      apply(text);
      syncState.lastSync = savedAt;
      // What we now have is what the folder has: nothing to write back.
      syncState.lastBody = body();
      return true;
    } catch (e) { fail(e); return false; }
  }

  /** Chooses the synced folder: adopts the settings already there, or seeds it with ours. */
  async function chooseSyncFolder(): Promise<boolean> {
    const dir = await s.dialogs.pickFolder({ defaultPath: settings.syncFolder ?? undefined });
    if (!dir) return false;
    settings.syncFolder = dir;
    syncState.lastSync = null;
    syncState.lastBody = null;
    const path = syncPath()!;
    if ((await s.fs.kind(path)) === 'file') {
      const adopt = await s.dialogs.confirm({ title: s.t('prefs.syncTitle'), message: s.t('prefs.syncFound'), ok: s.t('prefs.useSynced'), cancel: s.t('prefs.keepMine'), kind: 'info' });
      if (adopt && (await pull())) { s.notify.info(s.t('prefs.imported')); return true; }
    }
    await push();
    return true;
  }

  function stopSync() {
    settings.syncFolder = null;
    syncState.lastSync = null;
    syncState.lastBody = null;
  }

  return { exportTo, importFrom, push, pull, chooseSyncFolder, stopSync, syncPath };
}

export type Preferences = ReturnType<typeof createPreferences>;
