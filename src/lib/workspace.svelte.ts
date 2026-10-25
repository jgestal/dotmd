// Workspace facade for components: folders and favourites (rules in application/workspace.ts).
import { workspace } from './container';
export { missing } from './state.svelte';

export const {
  folders: workspaceFolders, addFolder, removeFolder, folderOf, isFavorite, toggleFavorite, removeFavorite,
  checkMissing, warnAboutMissing, resolveMissing, retarget: retargetWorkspace,
} = workspace;
