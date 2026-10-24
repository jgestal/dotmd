// Self-update from GitHub Releases (tauri-plugin-updater; updates are signed with the project key).
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ask } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { settings, toast } from './state.svelte';
import { t } from './i18n';
import { confirmCloseAll } from './actions';

const LAST_CHECK = 'dotmd.lastUpdateCheck';
const DAY = 24 * 60 * 60 * 1000;

/** `manual`: from the menu, so also report "up to date" and errors. */
export async function checkForUpdates(manual = false) {
  try {
    const update = await check();
    try { localStorage.setItem(LAST_CHECK, String(Date.now())); } catch {}
    if (!update) {
      if (manual) toast(t('upd.none', { version: await getVersion() }));
      return;
    }
    const yes = await ask(t('upd.body', { version: update.version, current: update.currentVersion }), {
      title: t('upd.title'), kind: 'info', okLabel: t('upd.install'), cancelLabel: t('upd.later'),
    });
    if (!yes || !(await confirmCloseAll())) return;
    toast(t('upd.downloading'), 60000);
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    if (manual) toast(t('toast.error', { msg: String(e) }), 5000);
    else console.warn('update check failed', e);
  }
}

/** At most one silent check a day, never in development builds. */
export function scheduleUpdateCheck() {
  if (import.meta.env.DEV || !settings.autoUpdate) return;
  let last = 0;
  try { last = Number(localStorage.getItem(LAST_CHECK) ?? 0); } catch {}
  if (Date.now() - last > DAY) setTimeout(() => checkForUpdates(false), 8000);
}
