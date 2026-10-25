// Composition root: the only place that picks concrete adapters and wires the use cases together.
// Everything else receives its dependencies (Services and state) instead of importing them.
import type { FileFilter, PlatformServices } from './ports';
import { tauriDialogs, tauriExporter, tauriFileSystem, tauriMarkdown, tauriProcess, tauriSearch, tauriWatcher, tauriWindow } from './infrastructure/tauri';
import { createDocuments } from './application/documents';
import { createWorkspace } from './application/workspace';
import { createFiles } from './application/files';
import { createPreferences } from './application/preferences';
import { app, missing, session, settings, toast, DEFAULT_SETTINGS } from './state.svelte';
import { t, type Key } from './i18n';
import { basename, dirname, isPlainText, isTextPath, join } from './path';

export const services: PlatformServices = {
  markdown: tauriMarkdown,
  exporter: tauriExporter,
  search: tauriSearch,
  process: tauriProcess,
  fs: tauriFileSystem,
  dialogs: tauriDialogs,
  window: tauriWindow,
  watcher: tauriWatcher,
  notify: { info: (m, ms) => toast(m, ms), error: (m, ms) => toast(m, ms ?? 5000) },
  t: (key, vars) => t(key as Key, vars),
};

export const fileFilters = (): FileFilter[] => [
  { name: t('dlg.markdown'), extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdx'] },
  { name: t('dlg.text'), extensions: ['txt', 'text', 'log', 'csv', 'tsv', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'rst', 'org'] },
  { name: t('dlg.all'), extensions: ['*'] },
];

export const workspace = createWorkspace({ services, session, state: app, missing, basename, dirname });

export const documents = createDocuments({
  services,
  state: app,
  session,
  settings,
  workspace: {
    revealFolderOf: (p) => workspace.revealFolderOf(p),
    openFolder: (dir) => {
      workspace.addFolder(dir);
      app.sidebar = true;
      app.sidebarTab = 'files';
    },
  },
  isPlainText,
  isTextPath,
  fileFilters,
  untitledPath: () => join(app.root ?? '', `${t('top.untitled')}.md`),
  basename,
});

export const files = createFiles({ services, documents, workspace, state: app, session, join, dirname, basename });

export const preferences = createPreferences({ services, settings, defaults: DEFAULT_SETTINGS, syncState: session.prefsSync, join });
