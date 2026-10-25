import { describe, expect, it, vi } from 'vitest';
const { app } = vi.hoisted(() => ({ app: { tabs: [{ id: 1 }, { id: 2 }], activeTab: 0 } }));
vi.mock('../state.svelte', () => ({ app }));
import { recallScroll, rememberScroll } from '../scrollMemory';

describe('scroll memory per tab', () => {
  it('keeps a position per tab and per view', () => {
    rememberScroll('preview', 1500);
    rememberScroll('source', 300);
    app.activeTab = 1;
    expect(recallScroll('preview')).toBe(0); // a tab never scrolled starts at the top
    rememberScroll('preview', 80);
    app.activeTab = 0;
    expect(recallScroll('preview')).toBe(1500);
    expect(recallScroll('source')).toBe(300);
    app.activeTab = 1;
    expect(recallScroll('preview')).toBe(80);
  });
});
