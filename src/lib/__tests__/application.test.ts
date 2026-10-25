// Use cases with in-memory adapters: no browser, no Tauri.
import { beforeEach, describe, expect, it } from 'vitest';
import { createDocuments, type DocumentState } from '../application/documents';
import { createWorkspace } from '../application/workspace';
import { createFiles } from '../application/files';
import { memoryServices } from '../infrastructure/memory';

const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const dirname = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';
const join = (a: string, b: string) => `${a}/${b}`;

function setup(files: Record<string, string> = {}) {
  const services = memoryServices(files);
  const state: DocumentState & { root: string | null } = {
    tabs: [], activeTab: -1, path: null, content: '', saved: '', mode: 'preview', crlf: false,
    docOpen: false, selection: '', sessionStartWords: -1, extVersion: 0, treeVersion: 0, root: null,
  };
  const session = { tabs: [] as string[], lastFile: null as string | null, recent: [] as string[], folders: [] as string[], favorites: [] as string[], recentFolders: [] as string[], lastFolder: null as string | null, expanded: [] as string[] };
  const missing: Record<string, boolean> = {};
  const workspace = createWorkspace({ services, session, state, missing, basename, dirname });
  const documents = createDocuments({
    services, state, session, settings: { defaultMode: 'preview' },
    workspace: { revealFolderOf: (p) => workspace.revealFolderOf(p), openFolder: (d) => workspace.addFolder(d) },
    isPlainText: (p) => !!p && !/\.md$/.test(p), isTextPath: (p) => /\.(md|txt)$/.test(p),
    fileFilters: () => [], untitledPath: () => '/untitled.md', basename,
  });
  const fileOps = createFiles({ services, documents, workspace, state, session, join, dirname, basename });
  return { services, state, session, missing, workspace, documents, files: fileOps };
}

describe('documents', () => {
  let w: ReturnType<typeof setup>;
  beforeEach(() => {
    w = setup({ '/p/a.md': '# A', '/p/b.md': '# B', '/p/win.md': 'one\r\ntwo\r\n', '/p/notes.txt': 'plain', '/p/bin.md': 'x\0y' });
  });

  it('opens a file in a tab, reveals its folder and records it as recent', async () => {
    await w.documents.openPath('/p/a.md');
    expect(w.state.path).toBe('/p/a.md');
    expect(w.state.content).toBe('# A');
    expect(w.state.tabs).toHaveLength(1);
    expect(w.session.folders).toEqual(['/p']);
    expect(w.session.recent[0]).toBe('/p/a.md');
    expect(w.services.window.title).toBe('a.md — DotMD');
    expect(w.services.watcher.watched).toEqual(['/p/a.md']);
  });

  it('reuses the tab of an already open file', async () => {
    await w.documents.openPath('/p/a.md');
    await w.documents.openPath('/p/b.md');
    await w.documents.openPath('/p/a.md');
    expect(w.state.tabs).toHaveLength(2);
    expect(w.state.activeTab).toBe(0);
  });

  it('keeps Windows line endings on save', async () => {
    await w.documents.openPath('/p/win.md');
    expect(w.state.content).toBe('one\ntwo\n');
    expect(w.documents.isDirty()).toBe(false);
    w.state.content += 'three\n';
    expect(await w.documents.save()).toBe(true);
    expect(w.services.fs.files.get('/p/win.md')).toBe('one\r\ntwo\r\nthree\r\n');
    expect(w.documents.isDirty()).toBe(false);
  });

  it('opens non-Markdown files in source mode instead of visual', async () => {
    w.state.mode = 'visual';
    w.state.docOpen = true;
    w.state.path = '/p/a.md';
    await w.documents.openPath('/p/notes.txt');
    expect(w.state.mode).not.toBe('visual');
  });

  it('reports binary files through the notifier', async () => {
    await w.documents.openPath('/p/bin.md');
    expect(w.state.tabs).toHaveLength(0);
    expect(w.services.notify.errors[0]).toContain('toast.binary');
  });

  it('asks before closing a modified tab and saves when told to', async () => {
    await w.documents.openPath('/p/a.md');
    w.state.content = '# A edited';
    w.services.dialogs.confirms.push(true); // "Save"
    expect(await w.documents.closeTab()).toBe(true);
    expect(w.services.fs.files.get('/p/a.md')).toBe('# A edited');
    expect(w.state.docOpen).toBe(false);
    expect(w.services.window.title).toBe('DotMD — Markdown Viewer & Editor');
  });

  it('discards changes when told not to save', async () => {
    await w.documents.openPath('/p/a.md');
    w.state.content = 'lost';
    w.services.dialogs.confirms.push(false); // "Don't save"
    await w.documents.closeTab();
    expect(w.services.fs.files.get('/p/a.md')).toBe('# A');
  });

  it('closes tabs to the right, to the left and the others', async () => {
    for (const f of ['a', 'b', 'win']) await w.documents.openPath(`/p/${f}.md`);
    await w.documents.closeTabsToRight(0);
    expect(w.state.tabs.map((t) => t.path)).toEqual(['/p/a.md']);
    await w.documents.openPath('/p/b.md');
    await w.documents.closeTabsToLeft(1);
    expect(w.state.tabs.map((t) => t.path)).toEqual(['/p/b.md']);
  });

  it('follows external changes, asking only when there are local edits', async () => {
    await w.documents.openPath('/p/a.md');
    await w.services.fs.writeText('/p/a.md', '# A v2');
    await w.documents.onExternalChange('/p/a.md');
    expect(w.state.content).toBe('# A v2');
    w.state.content = 'mine';
    await w.services.fs.writeText('/p/a.md', '# A v3');
    w.services.dialogs.confirms.push(false); // keep mine
    await w.documents.onExternalChange('/p/a.md');
    expect(w.state.content).toBe('mine');
    expect(w.services.dialogs.asked.at(-1)?.title).toBe('dlg.changedTitle');
  });

  it('saves untitled documents through the save dialog', async () => {
    w.documents.newDoc();
    w.state.content = 'new text';
    w.services.dialogs.saves.push('/p/new.md');
    expect(await w.documents.save()).toBe(true);
    expect(w.services.fs.files.get('/p/new.md')).toBe('new text');
    expect(w.state.path).toBe('/p/new.md');
  });

  it('walks back and forward through the history', async () => {
    await w.documents.openPath('/p/a.md');
    await w.documents.openPath('/p/b.md');
    await w.documents.goBack();
    expect(w.state.path).toBe('/p/a.md');
    await w.documents.goForward();
    expect(w.state.path).toBe('/p/b.md');
    expect(w.documents.canGoForward()).toBe(false);
  });

  it('restores the previous session, skipping files that are gone', async () => {
    w.session.tabs = ['/p/a.md', '/p/gone.md', '/p/b.md'];
    w.session.lastFile = '/p/a.md';
    await w.documents.restore();
    expect(w.state.tabs.map((t) => t.path)).toEqual(['/p/a.md', '/p/b.md']);
    expect(w.state.path).toBe('/p/a.md');
    expect(w.documents.canGoBack()).toBe(false);
  });

  it('toggles task checkboxes in the source', async () => {
    await w.services.fs.writeText('/p/t.md', '- [ ] one\n- [x] two');
    await w.documents.openPath('/p/t.md');
    w.documents.toggleTaskLine(1);
    w.documents.toggleTaskLine(2);
    expect(w.state.content).toBe('- [x] one\n- [ ] two');
  });
});

describe('workspace', () => {
  it('keeps several folders, most recent first, and closes them', () => {
    const w = setup();
    w.workspace.addFolder('/a');
    w.workspace.addFolder('/b');
    w.workspace.addFolder('/a');
    expect(w.session.folders).toEqual(['/a', '/b']);
    w.workspace.removeFolder('/a');
    expect(w.session.folders).toEqual(['/b']);
    expect(w.state.root).toBe('/b');
  });

  it('toggles favourites and flags the missing ones', async () => {
    const w = setup({ '/p/a.md': 'x' });
    w.workspace.toggleFavorite('/p/a.md');
    w.workspace.toggleFavorite('/p/gone.md');
    expect(w.workspace.isFavorite('/p/a.md')).toBe(true);
    expect(await w.workspace.warnAboutMissing()).toBe(1);
    expect(w.missing).toEqual({ '/p/gone.md': true });
    expect(w.services.notify.infos[0]).toContain('fav.missingToast');
    w.workspace.toggleFavorite('/p/a.md');
    expect(w.workspace.isFavorite('/p/a.md')).toBe(false);
  });

  it('relocates a missing favourite, or removes it', async () => {
    const w = setup({ '/new/a.md': 'x' });
    w.session.favorites = ['/old/a.md', '/old/b.md'];
    await w.workspace.checkMissing();
    w.services.dialogs.confirms.push(true); // Locate…
    w.services.dialogs.files.push(['/new/a.md']);
    await w.workspace.resolveMissing('/old/a.md', false);
    w.services.dialogs.confirms.push(false); // Remove
    await w.workspace.resolveMissing('/old/b.md', false);
    expect(w.session.favorites).toEqual(['/new/a.md']);
    expect(w.missing).toEqual({});
  });

  it('keeps folders as favourites: opens them in the sidebar, flags and relocates them', async () => {
    const w = setup({ '/p/docs/a.md': 'x' });
    w.workspace.toggleFavorite('/p/docs', true);
    w.workspace.toggleFavorite('/p/gone', true);
    expect(w.workspace.isFavoriteDir('/p/docs')).toBe(true);
    expect(await w.workspace.checkMissing()).toBe(1);
    expect(w.missing).toEqual({ '/p/gone': true });
    w.workspace.openFavoriteFolder('/p/docs');
    expect(w.session.folders).toEqual(['/p/docs']);
    expect(w.state.root).toBe('/p/docs');
    w.services.dialogs.confirms.push(true); // Locate… asks for a folder, not a file
    w.services.dialogs.folders.push('/p/new');
    await w.workspace.resolveMissing('/p/gone', false);
    expect(w.session.favorites).toEqual(['/p/docs', '/p/new']);
    expect(w.workspace.isFavoriteDir('/p/new')).toBe(true);
    w.workspace.toggleFavorite('/p/docs');
    expect(w.workspace.isFavoriteDir('/p/docs')).toBe(false);
  });

  it('opens every folder dropped on the window', async () => {
    const w = setup({ '/a/x.md': 'x', '/b/y.md': 'y' });
    await w.documents.handleDroppedPaths(['/a', '/b', '/a/x.md']);
    expect([...w.session.folders].sort()).toEqual(['/a', '/b']);
    expect(w.state.path).toBe('/a/x.md');
  });

  it('picks the deepest folder that contains a file', () => {
    const w = setup();
    w.workspace.addFolder('/a');
    w.workspace.addFolder('/a/b');
    expect(w.workspace.folderOf('/a/b/c.md')).toBe('/a/b');
    expect(w.workspace.folderOf('/z/c.md')).toBeNull();
  });
});

describe('quick wins', () => {
  it('reopens closed tabs, newest first', async () => {
    const w = setup({ '/p/a.md': 'a', '/p/b.md': 'b' });
    await w.documents.openPath('/p/a.md');
    await w.documents.openPath('/p/b.md');
    await w.documents.closeTab();
    await w.documents.closeTab();
    expect(w.state.tabs.length).toBe(0);
    expect(await w.documents.reopenClosed()).toBe(true);
    expect(w.state.path).toBe('/p/a.md');
    expect(await w.documents.reopenClosed()).toBe(true);
    expect(w.state.path).toBe('/p/b.md');
    expect(await w.documents.reopenClosed()).toBe(false);
  });

  it('duplicates a file next to itself', async () => {
    const w = setup({ '/p/a.md': 'text', '/p/a ctx.copySuffix.md': 'old' });
    const copy = await w.files.duplicate('/p/a.md');
    expect(copy).toBe('/p/a ctx.copySuffix 2.md');
    expect(w.services.fs.files.get(copy!)).toBe('text');
  });
});

describe('revert to saved', () => {
  it('asks before dropping edits, then reloads the file', async () => {
    const w = setup({ '/p/a.md': 'disk' });
    await w.documents.openPath('/p/a.md');
    w.state.content = 'edited';
    w.services.dialogs.confirms.push(false);
    expect(await w.documents.revert()).toBe(false);
    expect(w.state.content).toBe('edited');
    w.services.dialogs.confirms.push(true);
    expect(await w.documents.revert()).toBe(true);
    expect(w.state.content).toBe('disk');
    expect(w.state.saved).toBe('disk');
  });

  it('opens a document with content (the Markdown guide) without marking it unsaved', () => {
    const w = setup();
    w.documents.newDoc('# Guide', 'split');
    expect(w.state.content).toBe('# Guide');
    expect(w.state.mode).toBe('split');
    expect(w.documents.isDirty()).toBe(false);
  });
});

describe('file operations', () => {
  it('moves a file and keeps its tab, favourite and expanded folders pointing at it', async () => {
    const w = setup({ '/p/a.md': 'x', '/p/docs/keep.md': 'k' });
    await w.documents.openPath('/p/a.md');
    w.workspace.toggleFavorite('/p/a.md');
    expect(await w.files.move('/p/a.md', '/p/docs')).toBe(true);
    expect(w.services.fs.files.has('/p/docs/a.md')).toBe(true);
    expect(w.state.path).toBe('/p/docs/a.md');
    expect(w.session.favorites).toEqual(['/p/docs/a.md']);
    expect(await w.files.move('/p/docs', '/p/docs/inner')).toBe(false); // into itself
  });

  it('refuses to rename over an existing file', async () => {
    const w = setup({ '/p/a.md': 'x', '/p/b.md': 'y' });
    expect(await w.files.renameTo('/p/a.md', 'b.md')).toBe(false);
    expect(w.services.notify.errors[0]).toContain('toast.exists');
  });

  it('trashes a file after confirming and closes its tab without asking to save', async () => {
    const w = setup({ '/p/a.md': 'x' });
    await w.documents.openPath('/p/a.md');
    w.state.content = 'unsaved';
    w.services.dialogs.confirms.push(true); // confirm trash
    expect(await w.files.trash('/p/a.md')).toBe(true);
    expect(w.services.fs.trashed).toEqual(['/p/a.md']);
    expect(w.state.tabs).toHaveLength(0);
    expect(w.services.dialogs.asked).toHaveLength(1); // no "save changes?" prompt
  });

  it('creates a new Markdown file and opens it', async () => {
    const w = setup({ '/p/a.md': 'x' });
    expect(await w.files.createIn('/p', 'ideas')).toBe('/p/ideas.md');
    expect(w.state.path).toBe('/p/ideas.md');
  });

  it('saves pasted images next to the document', async () => {
    const w = setup({ '/p/a.md': 'x' });
    expect(await w.files.saveImage('shot.png', btoa('PNG'))).toBe(null); // no document yet
    await w.documents.openPath('/p/a.md');
    expect(await w.files.saveImage('shot.png', btoa('PNG'))).toBe('assets/shot.png');
    expect(w.services.fs.files.get('/p/assets/shot.png')).toBe('PNG');
  });
});
