import { describe, expect, it, vi } from 'vitest';
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null), convertFileSrc: (p: string) => p, Channel: class {} }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ setTitle: async () => {}, setTheme: async () => {}, setFullscreen: async () => {}, close: async () => {} }) }));
import { allCommands, formatShortcut } from '../commands';

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
