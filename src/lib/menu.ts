// Native menu bar built from the command registry.
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { t } from './i18n';
import { isMac } from './path';
import { allCommands, runCommand, type MenuId } from './commands';

const sep = () => PredefinedMenuItem.new({ item: 'Separator' });

async function itemsFor(menu: MenuId) {
  const out = [];
  for (const c of allCommands().filter((c) => c.menu === menu)) {
    if (c.separator && out.length) out.push(await sep());
    out.push(
      await MenuItem.new({
        id: c.id,
        text: c.label(),
        // Editor shortcuts are handled by the editors; binding them to the menu off macOS could fire twice.
        accelerator: c.shortcut && (!c.editorKey || isMac) ? c.shortcut : undefined,
        action: () => runCommand(c),
      }),
    );
  }
  return out;
}

/** (Re)builds the app menu; called on start and when the UI language changes. */
export async function installMenu() {
  const submenus = [];
  if (isMac) {
    submenus.push(
      await Submenu.new({
        text: 'DotMD',
        items: [
          await PredefinedMenuItem.new({ item: { About: null } }),
          await sep(),
          await MenuItem.new({ id: 'app.settings', text: t('top.settings') + '…', accelerator: 'CmdOrCtrl+,', action: () => runCommand(allCommands().find((c) => c.id === 'app.settings')!) }),
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
  submenus.push(await Submenu.new({ text: t('menu.file'), items: [...(await itemsFor('file')), ...(isMac ? [] : [await sep(), await PredefinedMenuItem.new({ item: 'Quit' })])] }));
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
        ...(await itemsFor('edit')),
      ],
    }),
  );
  submenus.push(await Submenu.new({ text: t('menu.format'), items: await itemsFor('format') }));
  submenus.push(await Submenu.new({ text: t('menu.view'), items: await itemsFor('view') }));
  const go = await itemsFor('go');
  if (go.length) submenus.push(await Submenu.new({ text: t('menu.go'), items: go }));
  submenus.push(
    await Submenu.new({
      text: t('menu.window'),
      items: [
        await PredefinedMenuItem.new({ item: 'Minimize' }),
        await PredefinedMenuItem.new({ item: 'Maximize' }),
        await PredefinedMenuItem.new({ item: 'Fullscreen' }),
        await sep(),
        await PredefinedMenuItem.new({ item: 'CloseWindow' }),
      ],
    }),
  );
  submenus.push(await Submenu.new({ text: t('menu.help'), items: await itemsFor('help') }));
  const menu = await Menu.new({ items: submenus });
  await menu.setAsAppMenu();
}
