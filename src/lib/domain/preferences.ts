// Preferences files: the settings as portable JSON, so they can be backed up, moved to another
// computer or kept in a synced folder (Google Drive, Dropbox, iCloud…).
import { AppError } from './errors';

export const PREFS_FORMAT = 'dotmd-preferences';
export const PREFS_FILE = 'dotmd-preferences.json';

/** Settings that describe this machine, never written to or read from a preferences file. */
export const LOCAL_ONLY = new Set(['syncFolder']);

export interface PrefsFile {
  format: typeof PREFS_FORMAT;
  version: 1;
  savedAt: string;
  settings: Record<string, unknown>;
}

/** The settings that travel between machines. */
export function portable(settings: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(settings).filter(([k]) => !LOCAL_ONLY.has(k)));
}

export function serializePrefs(settings: object, savedAt: Date): string {
  const file: PrefsFile = { format: PREFS_FORMAT, version: 1, savedAt: savedAt.toISOString(), settings: portable(settings) };
  return JSON.stringify(file, null, 2) + '\n';
}

const kind = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/**
 * Reads a preferences file against the defaults: only known keys whose type matches are kept
 * (nested objects such as `stats` are merged key by key); anything else is reported in `ignored`.
 */
export function parsePrefs<T extends object>(text: string, defaults: T): { settings: Partial<T>; savedAt: string; ignored: string[] } {
  let file: Partial<PrefsFile>;
  try {
    file = JSON.parse(text);
  } catch {
    throw new AppError('invalid', 'not a JSON file');
  }
  if (!file || file.format !== PREFS_FORMAT || typeof file.settings !== 'object' || !file.settings) {
    throw new AppError('invalid', 'not a DotMD preferences file');
  }
  const base = defaults as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const ignored: string[] = [];
  for (const [k, v] of Object.entries(file.settings)) {
    if (LOCAL_ONLY.has(k)) continue;
    const def = base[k];
    if (!(k in base)) { ignored.push(k); continue; }
    // null and string are interchangeable for optional values (e.g. typewriterPrev).
    const ok = kind(v) === kind(def) || (def === null || v === null);
    if (!ok) { ignored.push(k); continue; }
    if (kind(def) === 'object') {
      const nested: Record<string, unknown> = { ...(def as Record<string, unknown>) };
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (nk in nested && kind(nv) === kind(nested[nk])) nested[nk] = nv;
        else ignored.push(`${k}.${nk}`);
      }
      out[k] = nested;
    } else out[k] = v;
  }
  return { settings: out as Partial<T>, savedAt: typeof file.savedAt === 'string' ? file.savedAt : '', ignored };
}

/** The synced copy should replace the local settings when it was saved after our last sync. */
export function syncedIsNewer(remoteSavedAt: string, lastSync: string | null): boolean {
  if (!remoteSavedAt) return false;
  return !lastSync || Date.parse(remoteSavedAt) > Date.parse(lastSync);
}
