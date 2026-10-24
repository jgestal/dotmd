import { describe, expect, it } from 'vitest';
import { fuzzyMatch, highlight } from '../fuzzy';
import { formatTable, tableMarkdown, blockMarkdown } from '../snippets';
import { basename, codeLang, dirname, docKind, extname, isTextPath, join, relative, stem } from '../path';

describe('fuzzyMatch', () => {
  it('matches subsequences and prefers word starts', () => {
    expect(fuzzyMatch('rdm', 'README.md')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'README.md')).toBeNull();
    const a = fuzzyMatch('sec', 'notes/second.md')!.score;
    const b = fuzzyMatch('sec', 'notes/misc-elastic.md')!.score;
    expect(a).toBeGreaterThan(b);
  });
  it('highlights matches and escapes HTML', () => {
    const m = fuzzyMatch('ab', 'a<b')!;
    expect(highlight('a<b', m.indices)).toBe('<mark>a</mark>&lt;<mark>b</mark>');
  });
});

describe('tables', () => {
  it('generates and aligns GFM tables', () => {
    const t = tableMarkdown(2, 2).split('\n');
    expect(t).toHaveLength(3);
    const out = formatTable(['|a|bbbb|', '|:-|-:|', '|cc|d|']);
    expect(out[0]).toBe('| a   | bbbb |');
    expect(out[1]).toBe('| :-- | ---: |');
    expect(out[2]).toBe('| cc  | d    |');
  });
  it('keeps escaped pipes inside cells', () => {
    expect(formatTable(['| a \\| b | c |'])[0]).toContain('a \\| b');
  });
  it('builds block snippets', () => {
    expect(blockMarkdown({ type: 'alert', kind: 'NOTE' })).toBe('> [!NOTE]\n> ');
    expect(blockMarkdown({ type: 'image', src: 'my img.png', alt: 'x' })).toBe('![x](my%20img.png)');
    expect(blockMarkdown({ type: 'pagebreak' })).toContain('page-break');
  });
});

describe('paths', () => {
  it('splits paths on both separators', () => {
    expect(basename('/a/b/c.md')).toBe('c.md');
    expect(basename('C:\\docs\\x.txt')).toBe('x.txt');
    expect(dirname('/a/b/c.md')).toBe('/a/b');
    expect(extname('/a/B.MD')).toBe('md');
    expect(stem('/a/report.final.md')).toBe('report.final');
  });
  it('joins and relativises', () => {
    expect(join('/a/b', '../c/d.png')).toBe('/a/c/d.png');
    expect(join('/a/b', './x.md')).toBe('/a/b/x.md');
    expect(relative('/a/b', '/a/b/assets/i.png')).toBe('assets/i.png');
    expect(relative('/a/b', '/a/c/i.png')).toBe('../c/i.png');
  });
  it('classifies documents', () => {
    expect(docKind(null)).toBe('markdown');
    expect(docKind('/x/notes.markdown')).toBe('markdown');
    expect(docKind('/x/data.tsv')).toBe('csv');
    expect(docKind('/x/app.ts')).toBe('code');
    expect(codeLang('/x/app.ts')).toBe('typescript');
    expect(docKind('/x/Makefile')).toBe('code');
    expect(docKind('/x/server.log')).toBe('text');
    expect(isTextPath('/x/photo.jpg')).toBe(false);
    expect(isTextPath('/x/LICENSE')).toBe(true);
  });
});
