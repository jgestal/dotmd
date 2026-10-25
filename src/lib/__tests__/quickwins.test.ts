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
