import { Menu } from '@tauri-apps/api/menu';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { app, toast } from './state.svelte';
import { t } from './i18n';
import { askFields } from './prompt.svelte';
import { dirname, join, relative } from './path';
import { openFolder, openPath, renamePath, trashPath } from './actions';
import { exportRequest } from './exportRequest.svelte';
import { files } from './container';
import { folderOf, isFavorite, removeFolder, toggleFavorite, workspaceFolders } from './workspace.svelte';

interface Entry { name: string; path: string; is_dir: boolean }

async function newFileIn(dir: string) {
  const v = await askFields(t('ctx.newFile'), [{ key: 'name', label: t('common.name'), value: 'note.md' }]);
  if (v?.name) await files.createIn(dir, v.name);
}

async function rename(entry: Entry) {
  const v = await askFields(t('ctx.rename'), [{ key: 'name', label: t('common.name'), value: entry.name }]);
  if (v?.name && v.name !== entry.name) await renamePath(entry.path, v.name);
}

/** Native context menu for a file tree row. */
export async function treeContextMenu(entry: Entry) {
  const dir = entry.is_dir ? entry.path : dirname(entry.path);
  const items = [
    ...(entry.is_dir
      ? [{ id: 'root', text: t('ctx.openFolder'), action: () => openFolder(entry.path) }]
      : [{ id: 'open', text: t('ctx.open'), action: () => openPath(entry.path) }]),
    { id: 'new', text: t('ctx.newFile'), action: () => newFileIn(dir) },
    { id: 'rename', text: t('ctx.rename'), action: () => rename(entry) },
    { id: 'fav', text: isFavorite(entry.path) ? t('fav.removeShort') : t('fav.add'), action: () => toggleFavorite(entry.path, entry.is_dir) },
    ...(entry.is_dir && workspaceFolders().includes(entry.path) ? [{ id: 'close', text: t('ws.close'), action: () => removeFolder(entry.path) }] : []),
    { id: 'sep1', item: 'Separator' as const },
    ...(!entry.is_dir
      ? [
          { id: 'pdf', text: t('ctx.exportPdf'), action: () => exportRequest.open(entry.path, 'pdf') },
          { id: 'html', text: t('ctx.exportHtml'), action: () => exportRequest.open(entry.path, 'html') },
          { id: 'sep2', item: 'Separator' as const },
        ]
      : []),
    ...(!entry.is_dir ? [{ id: 'dup', text: t('ctx.duplicate'), action: () => files.duplicate(entry.path) }] : []),
    { id: 'reveal', text: t('ctx.reveal'), action: () => revealItemInDir(entry.path) },
    ...(!workspaceFolders().includes(entry.path) ? [{ id: 'trash', text: t('ctx.trash'), action: () => trashPath(entry.path) }] : []),
    {
      id: 'copy', text: t('ctx.copyPath'),
      action: async () => { await navigator.clipboard.writeText(entry.path); toast(t('toast.copied'), 1000); },
    },
    {
      // Relative to the open document (ready to paste as a link), else to its workspace folder.
      id: 'copyRel', text: t('ctx.copyRelative'),
      action: async () => {
        const from = app.path && app.path !== entry.path ? dirname(app.path) : folderOf(entry.path) ?? dirname(entry.path);
        await navigator.clipboard.writeText(relative(from, entry.path).replace(/\\/g, '/'));
        toast(t('toast.copied'), 1000);
      },
    },
  ];
  const menu = await Menu.new({
    items: items.map((i) => ('item' in i ? { item: i.item } : { id: i.id, text: i.text, action: () => void i.action() })) as any,
  });
  await menu.popup();
}
