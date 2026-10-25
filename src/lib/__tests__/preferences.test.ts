import { describe, expect, it } from 'vitest';
import { PREFS_FILE, parsePrefs, serializePrefs, syncedIsNewer } from '../domain/preferences';
import { createPreferences } from '../application/preferences';
import { memoryServices } from '../infrastructure/memory';
import { AppError } from '../domain/errors';

const DEFAULTS = { theme: 'auto', fontSize: 16, autosave: false, typewriterPrev: null as string | null, stats: { words: true, chars: false }, syncFolder: null as string | null };
const join = (a: string, b: string) => `${a}/${b}`;

describe('preferences file (domain)', () => {
  it('round-trips the settings without machine-local ones', () => {
    const text = serializePrefs({ ...DEFAULTS, theme: 'calm', syncFolder: '/Drive' }, new Date('2026-10-25T10:00:00Z'));
    expect(text).not.toContain('/Drive');
    const r = parsePrefs(text, DEFAULTS);
    expect(r.settings.theme).toBe('calm');
    expect(r.savedAt).toBe('2026-10-25T10:00:00.000Z');
    expect('syncFolder' in r.settings).toBe(false);
  });

  it('keeps only known keys of the right type and merges nested objects', () => {
    const text = JSON.stringify({ format: 'dotmd-preferences', version: 1, savedAt: '', settings: { theme: 'nord', fontSize: 'big', unknown: 1, stats: { chars: true, bogus: 1 }, typewriterPrev: '{"a":1}' } });
    const r = parsePrefs(text, DEFAULTS);
    expect(r.settings).toEqual({ theme: 'nord', stats: { words: true, chars: true }, typewriterPrev: '{"a":1}' });
    expect(r.ignored.sort()).toEqual(['fontSize', 'stats.bogus', 'unknown']);
  });

  it('rejects files that are not DotMD preferences', () => {
    expect(() => parsePrefs('nope', DEFAULTS)).toThrow(AppError);
    expect(() => parsePrefs('{"theme":"x"}', DEFAULTS)).toThrow(/preferences/);
  });

  it('decides when the synced copy is newer', () => {
    expect(syncedIsNewer('2026-01-02T00:00:00Z', null)).toBe(true);
    expect(syncedIsNewer('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(true);
    expect(syncedIsNewer('2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')).toBe(false);
    expect(syncedIsNewer('', null)).toBe(false);
  });
});

function setup(files: Record<string, string> = {}) {
  const services = memoryServices(files);
  const settings = structuredClone(DEFAULTS);
  const syncState = { lastSync: null as string | null, lastBody: null as string | null };
  let clock = Date.parse('2026-10-25T10:00:00Z');
  const prefs = createPreferences({ services, settings, defaults: DEFAULTS, syncState, join, now: () => new Date((clock += 1000)) });
  return { services, settings, syncState, prefs };
}

describe('preferences use cases', () => {
  it('exports to the chosen file and imports it back', async () => {
    const a = setup();
    a.settings.theme = 'terminal';
    a.services.dialogs.saves.push('/backup/prefs.json');
    expect(await a.prefs.exportTo()).toBe(true);
    const b = setup({ '/backup/prefs.json': a.services.fs.files.get('/backup/prefs.json')! });
    b.services.dialogs.files.push(['/backup/prefs.json']);
    expect(await b.prefs.importFrom()).toBe(true);
    expect(b.settings.theme).toBe('terminal');
    expect(b.services.notify.infos).toEqual(['prefs.imported']);
  });

  it('reports an invalid file without touching the settings', async () => {
    const a = setup({ '/x.json': '{"hello":1}' });
    a.services.dialogs.files.push(['/x.json']);
    expect(await a.prefs.importFrom()).toBe(false);
    expect(a.settings.theme).toBe('auto');
    expect(a.services.notify.errors).toEqual(['prefs.invalid']);
  });

  it('seeds an empty synced folder with the local settings', async () => {
    const a = setup();
    a.services.fs.dirs.add('/Drive');
    a.settings.fontSize = 18;
    a.services.dialogs.folders.push('/Drive');
    await a.prefs.chooseSyncFolder();
    expect(a.settings.syncFolder).toBe('/Drive');
    expect(JSON.parse(a.services.fs.files.get(`/Drive/${PREFS_FILE}`)!).settings.fontSize).toBe(18);
  });

  it('adopts the synced settings when the folder already has them and the user agrees', async () => {
    const remote = serializePrefs({ ...DEFAULTS, theme: 'msdos' }, new Date('2026-10-20T00:00:00Z'));
    const a = setup({ [`/Drive/${PREFS_FILE}`]: remote });
    a.services.dialogs.folders.push('/Drive');
    a.services.dialogs.confirms.push(true);
    await a.prefs.chooseSyncFolder();
    expect(a.settings.theme).toBe('msdos');
    // Nothing changed since: no write back.
    expect(await a.prefs.push()).toBe(false);
  });

  it('pulls changes another computer made, and only pushes real changes', async () => {
    const a = setup();
    a.services.fs.dirs.add('/Drive');
    a.services.dialogs.folders.push('/Drive');
    await a.prefs.chooseSyncFolder();
    expect(await a.prefs.push()).toBe(false);
    a.settings.autosave = true;
    expect(await a.prefs.push()).toBe(true);

    // Another machine writes a newer file.
    a.services.fs.put(`/Drive/${PREFS_FILE}`, serializePrefs({ ...a.settings, theme: 'aqua' }, new Date('2030-01-01T00:00:00Z')));
    expect(await a.prefs.pull()).toBe(true);
    expect(a.settings.theme).toBe('aqua');
    expect(a.settings.syncFolder).toBe('/Drive');
    expect(await a.prefs.pull()).toBe(false);
    expect(await a.prefs.push()).toBe(false);
  });

  it('stops syncing', async () => {
    const a = setup();
    a.settings.syncFolder = '/Drive';
    a.prefs.stopSync();
    expect(a.settings.syncFolder).toBeNull();
    expect(await a.prefs.push()).toBe(false);
  });
});
