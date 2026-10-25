// Native menu bar built from the command registry: submenus, check marks and enabled states
// follow the app state live; the whole menu is rebuilt only when labels or lists change.
import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getVersion } from '@tauri-apps/api/app';
import { t } from './i18n';
import { isMac } from './path';
import { allCommands, menuTree, runCommand, type Command, type MenuId, type MenuNode } from './commands';
import { app, session, clearHistory } from './state.svelte';
import { basename, dirname } from './path';
import { openFolder, openPath, activateTab } from './actions';

const sep = () => PredefinedMenuItem.new({ item: 'Separator' });

type Live = { command: Command; item: MenuItem | CheckMenuItem; enabled: boolean; checked?: boolean };
let live: Live[] = [];

async function commandItem(c: Command) {
  const common = {
    id: c.id,
    text: c.menuLabel?.() ?? c.label(),
    enabled: c.enabled?.() ?? true,
    // Editor shortcuts are handled by the editors; binding them to the menu off macOS could fire twice.
    accelerator: c.shortcut && (!c.editorKey || isMac) ? c.shortcut : undefined,
    action: () => runCommand(c),
  };
  const item = c.checked ? await CheckMenuItem.new({ ...common, checked: c.checked() }) : await MenuItem.new(common);
  live.push({ command: c, item, enabled: common.enabled, checked: c.checked?.() });
  return item;
}

async function build(nodes: MenuNode[]): Promise<(MenuItem | CheckMenuItem | Submenu | PredefinedMenuItem)[]> {
  const out = [];
  for (const n of nodes) {
    if (n.kind === 'separator') out.push(await sep());
    else if (n.kind === 'command') out.push(await commandItem(n.command));
    else out.push(await Submenu.new({ text: t(n.label), items: await build(n.items) }));
  }
  return out;
}

const itemsFor = (menu: MenuId, skip: string[] = []) => build(menuTree(allCommands().filter((c) => !skip.includes(c.id)), menu));
const run = (id: string) => () => { const c = allCommands().find((x) => x.id === id); if (c) runCommand(c); };

async function recentMenu() {
  const items = [];
  for (const [i, p] of session.recent.slice(0, 12).entries()) {
    items.push(await MenuItem.new({ id: `recent.${i}`, text: `${basename(p)} — ${dirname(p)}`, action: () => void openPath(p) }));
  }
  const folders = (session.recentFolders ?? []).slice(0, 8);
  if (folders.length) {
    if (items.length) items.push(await sep());
    for (const [i, p] of folders.entries()) {
      items.push(await MenuItem.new({ id: `recentdir.${i}`, text: `📁 ${basename(p)} — ${dirname(p)}`, action: () => void openFolder(p) }));
    }
  }
  const any = items.length > 0;
  if (any) items.push(await sep());
  items.push(await MenuItem.new({ id: 'recent.clear', text: t('menu.clearRecent'), enabled: any, action: () => clearHistory() }));
  return Submenu.new({ text: t('menu.recent'), items });
}

async function aboutItem() {
  return PredefinedMenuItem.new({
    text: t('menu.about'),
    item: {
      About: {
        name: 'DotMD',
        version: await getVersion(),
        authors: ['Juan Gestal <juan@gestal.es>'],
        website: 'https://gestal.es',
        websiteLabel: 'gestal.es',
        copyright: '© 2026 Juan Gestal · MIT License',
        comments: 'Markdown Viewer & Editor',
      },
    },
  });
}

/** Open documents, listed in the Window menu like other document apps (active one checked). */
async function windowMenu() {
  const items = [
    await PredefinedMenuItem.new({ item: 'Minimize' }),
    await PredefinedMenuItem.new({ item: 'Maximize', text: isMac ? t('menu.zoom') : undefined }),
  ];
  if (app.tabs.length) items.push(await sep());
  for (const [i, tab] of app.tabs.slice(0, 20).entries()) {
    items.push(await CheckMenuItem.new({
      id: `window.tab.${i}`,
      text: tab.path ? basename(tab.path) : t('top.untitled'),
      checked: i === app.activeTab,
      action: () => void activateTab(i),
    }));
  }
  return Submenu.new({ text: t('menu.window'), items });
}

/** (Re)builds the app menu: on start, and when the language, recent files or open tabs change. */
export async function installMenu() {
  live = [];
  const settingsCmd = allCommands().find((c) => c.id === 'app.settings')!;
  const settingsItem = () => MenuItem.new({ id: 'app.settings', text: t('top.settings') + '…', accelerator: 'CmdOrCtrl+,', action: () => runCommand(settingsCmd) });
  const submenus = [];
  if (isMac) {
    submenus.push(
      await Submenu.new({
        text: 'DotMD',
        items: [
          await aboutItem(),
          // macOS convention: updates are checked from the application menu.
          await MenuItem.new({ id: 'app.updates', text: t('cmd.checkUpdates'), action: run('help.updates') }),
          await sep(),
          await settingsItem(),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Services' }),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Hide' }),
          await PredefinedMenuItem.new({ item: 'HideOthers' }),
          await PredefinedMenuItem.new({ item: 'ShowAll' }),
          await sep(),
          await PredefinedMenuItem.new({ item: 'Quit' }),
        ],
      }),
    );
  }
  const fileItems = await itemsFor('file');
  // "Open Recent" goes right after "Open folder…".
  const at = fileItems.findIndex((i) => (i as MenuItem).id === 'file.openFolder') + 1;
  fileItems.splice(at, 0, await recentMenu());
  // Windows and Linux: Settings and Exit live in the File menu.
  const fileTail = isMac ? [] : [await sep(), await settingsItem(), await sep(), await PredefinedMenuItem.new({ item: 'Quit', text: t('menu.exit') })];
  submenus.push(await Submenu.new({ text: t('menu.file'), items: [...fileItems, ...fileTail] }));
  submenus.push(
    await Submenu.new({
      text: t('menu.edit'),
      items: [
        await PredefinedMenuItem.new({ item: 'Undo' }),
        await PredefinedMenuItem.new({ item: 'Redo' }),
        await sep(),
        await PredefinedMenuItem.new({ item: 'Cut' }),
        await PredefinedMenuItem.new({ item: 'Copy' }),
        await PredefinedMenuItem.new({ item: 'Paste' }),
        await PredefinedMenuItem.new({ item: 'SelectAll' }),
        await sep(),
        ...(await itemsFor('edit')),
      ],
    }),
  );
  submenus.push(await Submenu.new({ text: t('menu.format'), items: await itemsFor('format') }));
  // Full screen lives in View (macOS adds the globe/fn-F shortcut, F11 elsewhere).
  submenus.push(await Submenu.new({ text: t('menu.view'), items: [...(await itemsFor('view')), await sep(), await PredefinedMenuItem.new({ item: 'Fullscreen', text: t('menu.fullscreen') })] }));
  const go = await itemsFor('go');
  if (go.length) submenus.push(await Submenu.new({ text: t('menu.go'), items: go }));
  submenus.push(await windowMenu());
  const help = await itemsFor('help', isMac ? ['help.updates'] : []);
  if (!isMac) help.push(await sep(), await aboutItem());
  submenus.push(await Submenu.new({ text: t('menu.help'), items: help }));
  const menu = await Menu.new({ items: submenus });
  await menu.setAsAppMenu();
  syncMenuState();
}

/** Updates enabled states and check marks in place (cheap; called from a reactive effect). */
export function syncMenuState() {
  for (const l of live) {
    const enabled = l.command.enabled?.() ?? true;
    if (enabled !== l.enabled) { l.enabled = enabled; void l.item.setEnabled(enabled).catch(() => {}); }
    if (l.command.checked) {
      const checked = l.command.checked();
      if (checked !== l.checked) { l.checked = checked; void (l.item as CheckMenuItem).setChecked(checked).catch(() => {}); }
    }
  }
}
