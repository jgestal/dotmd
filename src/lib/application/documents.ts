// Use cases for documents and tabs: open, save, close, live reload, session restore.
// Depends only on ports (injected Services) and on plain state objects, so it runs in unit tests
// with in-memory adapters exactly as it runs in the app with Tauri ones.
import type { FileFilter, Services } from '../ports';
import { AppError, errorMessage, toAppError } from '../domain/errors';
import {
  NavigationHistory, cycleIndex, fromDisk, indexAfterClose, isPristine, isTabDirty, modeForOpen, retargetPath, tabsToClose, toDisk, toggleTask,
  type Mode, type Tab,
} from '../domain/documents';
import { pushRecent } from '../domain/workspace';

/** The observable state the editors bind to (a Svelte $state object in the app, a plain object in tests). */
export interface DocumentState {
  tabs: Tab[];
  activeTab: number;
  path: string | null;
  content: string;
  saved: string;
  mode: Mode;
  crlf: boolean;
  docOpen: boolean;
  selection: string;
  sessionStartWords: number;
  /** Bumped when content is replaced from outside the editors. */
  extVersion: number;
  treeVersion: number;
}

export interface DocumentSession {
  tabs: string[];
  lastFile: string | null;
  recent: string[];
}

/** What documents need from the workspace (folders in the sidebar). */
export interface WorkspaceLink {
  revealFolderOf(path: string): void;
  openFolder(dir: string): Promise<void> | void;
}

export interface DocumentDeps {
  services: Services;
  state: DocumentState;
  session: DocumentSession;
  settings: { defaultMode: Mode };
  workspace: WorkspaceLink;
  /** Non-Markdown text (plain text, code, data): no visual editor, no Markdown toolbar. */
  isPlainText(path: string | null): boolean;
  isTextPath(path: string): boolean;
  fileFilters(): FileFilter[];
  untitledPath(): string;
  basename(path: string): string;
}

export const APP_TITLE = 'DotMD — Markdown Viewer & Editor';

export function createDocuments(d: DocumentDeps) {
  const { services: s, state, session } = d;
  const history = new NavigationHistory();
  let tabSeq = 0;

  const docName = (path = state.path) => (path ? d.basename(path) : s.t('top.untitled'));
  const windowTitle = () => (state.docOpen ? `${docName()} — DotMD` : APP_TITLE);
  const isDirty = () => isTabDirty(state);

  /** Single place where failures become user-facing messages. */
  function report(e: unknown, path?: string | null) {
    const err = toAppError(e, path ?? undefined);
    if (err.code === 'cancelled') return;
    const { key, vars } = errorMessage(err, path ? d.basename(path) : '');
    s.notify.error(s.t(key, vars), 5000);
  }

  /** Copies the active document into its tab entry. */
  function snapshot() {
    const tb = state.tabs[state.activeTab];
    if (tb) Object.assign(tb, { path: state.path, content: state.content, saved: state.saved, mode: state.mode, crlf: state.crlf });
  }

  function persist() {
    session.tabs = state.tabs.map((x) => x.path).filter((p): p is string => !!p);
    session.lastFile = state.path;
  }

  const rewatch = () => s.watcher.watch([...new Set(state.tabs.map((x) => x.path).filter((p): p is string => !!p))]);

  function activateTab(i: number) {
    const tb = state.tabs[i];
    if (!tb) return;
    if (i !== state.activeTab) snapshot();
    Object.assign(state, {
      activeTab: i, path: tb.path, saved: tb.saved, content: tb.content, mode: tb.mode, crlf: tb.crlf,
      docOpen: true, selection: '', sessionStartWords: -1, extVersion: state.extVersion + 1,
    });
    persist();
    void s.window.setTitle(windowTitle());
  }

  function addTab(tab: Omit<Tab, 'id'>, reuseActive: boolean) {
    const cur = state.tabs[state.activeTab];
    if (reuseActive && isPristine(cur) && state.content === '' && state.saved === '') {
      Object.assign(cur, tab);
      state.activeTab = -1; // force a full load of the reused tab
      activateTab(state.tabs.indexOf(cur));
    } else {
      snapshot();
      const at = state.activeTab + 1;
      state.tabs.splice(at, 0, { id: ++tabSeq, ...tab });
      state.activeTab = -1;
      activateTab(at);
    }
    void rewatch();
  }

  async function save(as = false): Promise<boolean> {
    let path = state.path;
    if (!path || as) {
      path = await s.dialogs.saveFile({ defaultPath: state.path ?? d.untitledPath(), filters: d.fileFilters() });
      if (!path) return false;
    }
    const text = state.content;
    try {
      await s.fs.writeText(path, toDisk(text, state.crlf));
    } catch (e) {
      await s.dialogs.alert(toAppError(e, path).message, 'error');
      return false;
    }
    state.saved = text;
    if (path !== state.path) {
      state.path = path;
      session.recent = pushRecent(session.recent, path, 12);
      void s.window.setTitle(windowTitle());
      state.treeVersion++;
    }
    snapshot();
    persist();
    void rewatch();
    s.notify.info(s.t('toast.saved'), 1200);
    return true;
  }

  /** Unsaved changes in the active tab: save or discard. Returns false when saving failed. */
  async function confirmDiscard(): Promise<boolean> {
    if (!isDirty()) return true;
    const saveIt = await s.dialogs.confirm({
      title: s.t('dlg.unsavedTitle'), message: s.t('dlg.unsavedBody', { name: docName() }), ok: s.t('dlg.save'), cancel: s.t('dlg.discard'),
    });
    return saveIt ? save() : true;
  }

  async function closeTab(i = state.activeTab): Promise<boolean> {
    if (!state.tabs[i]) return true;
    if (i !== state.activeTab) activateTab(i);
    if (!(await confirmDiscard())) return false;
    state.tabs.splice(i, 1);
    state.activeTab = -1;
    const next = indexAfterClose(i, state.tabs.length);
    if (next >= 0) activateTab(next);
    else {
      Object.assign(state, { docOpen: false, path: null, content: '', saved: '', extVersion: state.extVersion + 1 });
      persist();
      void s.window.setTitle(windowTitle());
    }
    void rewatch();
    return true;
  }

  async function closeTabs(which: 'others' | 'right' | 'left', anchor = state.activeTab) {
    const keepId = state.tabs[anchor]?.id;
    if (keepId === undefined) return;
    for (const i of tabsToClose(state.tabs.length, anchor, which)) {
      const idx = state.tabs.findIndex((x) => x.id === state.tabs[i]?.id);
      if (idx >= 0 && !(await closeTab(idx))) return;
    }
    activateTab(state.tabs.findIndex((x) => x.id === keepId));
  }

  async function openPath(path: string, opts: { fromHistory?: boolean } = {}) {
    const kind = await s.fs.kind(path);
    if (kind === 'dir') return d.workspace.openFolder(path);
    if (kind !== 'file' || path === state.path) return;
    if (!opts.fromHistory) history.visit(state.path);
    const existing = state.tabs.findIndex((x) => x.path === path);
    if (existing >= 0) return activateTab(existing);
    try {
      const disk = fromDisk(await s.fs.readText(path));
      const mode = modeForOpen({
        current: state.mode, defaultMode: d.settings.defaultMode, hadDocument: state.docOpen,
        prevIsText: state.path ? d.isPlainText(state.path) : null, isText: d.isPlainText(path),
      });
      addTab({ path, content: disk.text, saved: disk.text, mode, crlf: disk.crlf }, true);
      d.workspace.revealFolderOf(path);
      session.recent = pushRecent(session.recent, path, 12);
    } catch (e) {
      report(e, path);
    }
  }

  /** Another program changed an open file. */
  async function onExternalChange(path: string) {
    let text: string;
    try { text = fromDisk(await s.fs.readText(path)).text; } catch { return; }
    if (path !== state.path) {
      // Background tab: follow the disk silently unless it has unsaved edits.
      const tb = state.tabs.find((x) => x.path === path);
      if (tb && !isTabDirty(tb)) tb.content = tb.saved = text;
      return;
    }
    if (text === state.content || text === state.saved) return;
    if (isDirty()) {
      const reload = await s.dialogs.confirm({
        title: s.t('dlg.changedTitle'), message: s.t('dlg.changedBody', { name: docName() }), ok: s.t('dlg.reload'), cancel: s.t('dlg.keep'),
      });
      if (!reload) { state.saved = text; return; }
    }
    replaceContent(text, true);
    s.notify.info(s.t('toast.reloaded'), 1400);
  }

  function replaceContent(text: string, saved: boolean) {
    state.content = text;
    if (saved) state.saved = text;
    state.extVersion++;
  }

  return {
    docName,
    windowTitle,
    isDirty,
    activateTab,
    openPath,
    save,
    confirmDiscard,
    closeTab,
    closeOtherTabs: (i?: number) => closeTabs('others', i),
    closeTabsToRight: (i?: number) => closeTabs('right', i),
    closeTabsToLeft: (i?: number) => closeTabs('left', i),
    onExternalChange,
    replaceContent,
    newDoc() {
      addTab({ path: null, content: '', saved: '', mode: d.settings.defaultMode === 'preview' ? 'source' : d.settings.defaultMode, crlf: false }, false);
    },
    async openFileDialog() {
      for (const f of await s.dialogs.pickFiles({ multiple: true, filters: d.fileFilters() })) await openPath(f);
    },
    cycleTab(delta: number) {
      if (state.tabs.length > 1) activateTab(cycleIndex(state.activeTab, delta, state.tabs.length));
    },
    moveTab(from: number, to: number) {
      if (from === to || !state.tabs[from]) return;
      snapshot();
      const activeId = state.tabs[state.activeTab]?.id;
      const [tb] = state.tabs.splice(from, 1);
      state.tabs.splice(to, 0, tb);
      state.activeTab = state.tabs.findIndex((x) => x.id === activeId);
      persist();
    },
    anyDirty() {
      snapshot();
      return state.tabs.some(isTabDirty);
    },
    /** Before quitting: offers to save every modified tab. */
    async confirmCloseAll(): Promise<boolean> {
      snapshot();
      for (let i = 0; i < state.tabs.length; i++) {
        if (!isTabDirty(state.tabs[i])) continue;
        activateTab(i);
        if (!(await confirmDiscard())) return false;
      }
      return true;
    },
    canGoBack: () => history.canGoBack,
    canGoForward: () => history.canGoForward,
    async goBack() {
      const p = history.goBack(state.path);
      if (p) await openPath(p, { fromHistory: true });
    },
    async goForward() {
      const p = history.goForward(state.path);
      if (p) await openPath(p, { fromHistory: true });
    },
    /** Reopens the tabs of the previous session. */
    async restore() {
      // Read before reopening: opening tabs updates lastFile.
      const last = session.lastFile;
      for (const p of [...(session.tabs ?? [])]) if ((await s.fs.kind(p)) === 'file') await openPath(p, { fromHistory: true });
      if (last && (await s.fs.kind(last)) === 'file') await openPath(last, { fromHistory: true });
      history.clear();
    },
    async handleDroppedPaths(paths: string[]) {
      for (const p of paths) if ((await s.fs.kind(p)) === 'dir') { await d.workspace.openFolder(p); break; }
      for (const f of paths.filter(d.isTextPath)) await openPath(f);
    },
    toggleTaskLine(line: number) {
      const next = toggleTask(state.content, line);
      if (next !== null) replaceContent(next, false);
    },
    /** Points open tabs (and the active document) at a file or folder's new location. */
    retarget(from: string, to: string) {
      for (const tb of state.tabs) if (tb.path) tb.path = retargetPath(tb.path, from, to);
      if (state.path) state.path = retargetPath(state.path, from, to);
      persist();
      void rewatch();
    },
    /** Closes the tabs of files that no longer exist (moved to the trash), without asking to save. */
    async forgetWhere(under: (p: string) => boolean) {
      snapshot();
      for (let i = state.tabs.length - 1; i >= 0; i--) {
        const tb = state.tabs[i];
        if (!tb.path || !under(tb.path)) continue;
        tb.saved = tb.content;
        if (i === state.activeTab) state.saved = state.content;
        await closeTab(i);
      }
    },
    report,
  };
}

export type Documents = ReturnType<typeof createDocuments>;
export { AppError };
