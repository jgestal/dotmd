import { describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null), convertFileSrc: (p: string) => p, Channel: class {} }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ setTitle: async () => {}, setTheme: async () => {}, setFullscreen: async () => {}, close: async () => {} }) }));
import { allCommands, formatShortcut, menuTree, type MenuNode } from '../commands';

describe('command registry', () => {
  it('has unique ids', () => {
    const ids = allCommands().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('never binds two commands to the same shortcut', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const c of allCommands()) {
      if (!c.shortcut) continue;
      const k = c.shortcut.toLowerCase();
      if (seen.has(k)) clashes.push(`${c.shortcut}: ${seen.get(k)} / ${c.id}`);
      seen.set(k, c.id);
    }
    expect(clashes).toEqual([]);
  });
  it('labels every command', () => {
    for (const c of allCommands()) expect(c.label().length, c.id).toBeGreaterThan(0);
  });
  it('formats shortcuts for display', () => {
    expect(formatShortcut('CmdOrCtrl+Shift+P')).toMatch(/^(⌘⇧P|Ctrl\+Shift\+P)$/);
  });
});

describe('native menu layout', () => {
  const labels = (nodes: MenuNode[]): unknown[] =>
    nodes.map((n) => (n.kind === 'separator' ? '—' : n.kind === 'command' ? n.command.id : { [n.label]: labels(n.items) }));

  it('groups edit commands in submenus without leading or doubled separators', () => {
    const tree = menuTree(allCommands(), 'edit');
    const subs = tree.filter((n) => n.kind === 'submenu').map((n) => (n as { label: string }).label);
    expect(subs).toEqual(['menu.find', 'menu.selection', 'menu.lines', 'menu.transform']);
    const check = (nodes: MenuNode[]) => {
      expect(nodes[0]?.kind).not.toBe('separator');
      nodes.forEach((n, i) => {
        if (n.kind === 'separator') expect(nodes[i + 1]?.kind, 'doubled separator').not.toBe('separator');
        if (n.kind === 'submenu') check(n.items);
      });
    };
    for (const m of ['file', 'edit', 'format', 'view', 'go', 'help'] as const) check(menuTree(allCommands(), m));
    expect(JSON.stringify(labels(tree))).toContain('"menu.lines":["edit.duplicateLine"');
  });

  it('puts headings, insertions, themes and languages in submenus', () => {
    const fmt = labels(menuTree(allCommands(), 'format'));
    expect(fmt).toContainEqual({ 'menu.heading': ['fmt.h1', 'fmt.h2', 'fmt.h3', 'fmt.paragraph'] });
    expect(JSON.stringify(fmt)).toMatch(/"menu.insert":\["fmt.link","fmt.image","fmt.table"/);
    const view = JSON.stringify(labels(menuTree(allCommands(), 'view')));
    expect(view).toContain('"menu.theme":["theme.auto","—","theme.modern"');
    expect(view).toContain('"menu.language":["lang.en","lang.es"');
  });

  it('marks toggles and choices with check marks', () => {
    const byId = (id: string) => allCommands().find((c) => c.id === id)!;
    for (const id of ['view.sidebar', 'view.pages', 'view.wrap', 'view.zen', 'view.typewriter', 'view.source', 'theme.calm', 'lang.es']) {
      expect(typeof byId(id).checked, id).toBe('function');
    }
    expect(byId('theme.calm').menuLabel?.()).toBe('Calm');
  });
});
