import { describe, expect, it } from 'vitest';
import { addWritingTime, duplicateName, pushClosed } from '../domain/documents';
import { sortEntries } from '../domain/workspace';

describe('duplicateName', () => {
  it('adds a copy suffix before the extension and counts up', () => {
    const taken = new Set(['notes copy.md']);
    expect(duplicateName('notes.md', () => false)).toBe('notes copy.md');
    expect(duplicateName('notes.md', (n) => taken.has(n))).toBe('notes copy 2.md');
    expect(duplicateName('README', () => false, 'copia')).toBe('README copia');
    expect(duplicateName('.env', () => false)).toBe('.env copy');
  });
});

describe('pushClosed', () => {
  it('keeps the newest last, once, up to a maximum', () => {
    expect(pushClosed(['/a', '/b'], '/a')).toEqual(['/b', '/a']);
    expect(pushClosed(['/a', '/b', '/c'], '/d', 3)).toEqual(['/b', '/c', '/d']);
  });
});

describe('addWritingTime', () => {
  it('counts short gaps between edits and ignores breaks', () => {
    expect(addWritingTime(0, 0, 5000)).toBe(0); // first edit
    expect(addWritingTime(1000, 10_000, 14_000)).toBe(5000);
    expect(addWritingTime(1000, 10_000, 10_000 + 5 * 60_000)).toBe(1000);
  });
});

describe('sortEntries', () => {
  const list = [
    { name: 'b.md', is_dir: false, modified: 3 },
    { name: 'docs', is_dir: true, modified: 1 },
    { name: 'a10.md', is_dir: false, modified: 1 },
    { name: 'a2.md', is_dir: false, modified: 2 },
  ];
  it('sorts folders first, then by natural name', () => {
    expect(sortEntries(list, 'name').map((e) => e.name)).toEqual(['docs', 'a2.md', 'a10.md', 'b.md']);
  });
  it('sorts by modification, newest first', () => {
    expect(sortEntries(list, 'modified').map((e) => e.name)).toEqual(['docs', 'b.md', 'a2.md', 'a10.md']);
  });
});

import { linkAt } from '../links';
import { linkPath } from '../path';
import { goalProgress } from '../stats';
import { longDate } from '../snippets';

describe('linkAt (⌘-click in the editor)', () => {
  const line = 'See [the docs](https://tauri.app "Tauri") and [a note](notes/second.md), <mailto:a@b.es> or www.gestal.es.';
  it('finds the target of the link under the column', () => {
    expect(linkAt(line, line.indexOf('the docs') + 2)).toBe('https://tauri.app');
    expect(linkAt(line, line.indexOf('notes/second') + 3)).toBe('notes/second.md');
    expect(linkAt(line, line.indexOf('a note'))).toBe('notes/second.md');
  });
  it('understands autolinks and bare URLs (without trailing punctuation)', () => {
    expect(linkAt(line, line.indexOf('mailto') + 2)).toBe('mailto:a@b.es');
    expect(linkAt(line, line.indexOf('gestal') + 1)).toBe('https://www.gestal.es');
    expect(linkAt('go to https://example.com/x, now', 8)).toBe('https://example.com/x');
  });
  it('returns null outside links', () => {
    expect(linkAt(line, 1)).toBeNull();
    expect(linkAt('plain text', 3)).toBeNull();
  });
});

describe('linkPath (Copy Relative Path)', () => {
  it('is relative to the open document', () => {
    expect(linkPath('/p/notes/b.md', '/p/a.md', '/p')).toBe('notes/b.md');
    expect(linkPath('/p/a.md', '/p/notes/b.md', '/p')).toBe('../a.md');
  });
  it('falls back to the workspace folder without a document, or for the document itself', () => {
    expect(linkPath('/p/notes/b.md', null, '/p')).toBe('notes/b.md');
    expect(linkPath('/p/notes/b.md', '/p/notes/b.md', '/p')).toBe('notes/b.md');
    expect(linkPath('/x/y/z.md', null, null)).toBe('z.md');
  });
  it('uses forward slashes for Windows paths', () => {
    expect(linkPath('C:\\p\\notes\\b.md', 'C:\\p\\a.md', 'C:\\p')).toBe('notes/b.md');
  });
});

describe('goalProgress (distraction-free bar)', () => {
  it('shows the count against the goal, capped at 100 %', () => {
    expect(goalProgress(412, 1000, 'es', 'palabras')).toEqual({ text: '412 / 1000 palabras', progress: 0.412 });
    expect(goalProgress(1500, 1000, 'en', 'words')).toEqual({ text: '1,500 / 1,000 words', progress: 1 });
  });
  it('shows only the count without a goal', () => {
    expect(goalProgress(25, 0, 'en', 'words')).toEqual({ text: '25 words', progress: null });
  });
});

describe('longDate', () => {
  it('writes the date out in the UI language', () => {
    const year = String(new Date().getFullYear());
    expect(longDate('es')).toMatch(new RegExp(`^\\d{1,2} de [a-záéíóú]+ de ${year}$`));
    expect(longDate('en')).toMatch(new RegExp(`^[A-Z][a-z]+ \\d{1,2}, ${year}$`));
    expect(longDate('de')).toMatch(new RegExp(`^\\d{1,2}\\. [A-ZÄÖÜ][a-zäöü]+ ${year}$`));
  });
});
