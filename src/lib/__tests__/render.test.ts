import { describe, expect, it } from 'vitest';
import { parseCsv, frontMatterHtml, escapeHtml } from '../render';
import { coversLatin } from '../export';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes and embedded newlines', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n"multi\nline",2')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', '2'],
    ]);
  });
  it('detects semicolons and tabs', () => {
    expect(parseCsv('a;b;c\n1;2;3')[1]).toEqual(['1', '2', '3']);
    expect(parseCsv('a\tb\n1\t2', true)[1]).toEqual(['1', '2']);
  });
  it('accepts CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('front matter and escaping', () => {
  it('renders YAML front matter as a table', () => {
    const html = frontMatterHtml('---\ntitle: "Hi <b>"\ntags: x\n---\n# Body');
    expect(html).toContain('<th>title</th><td>Hi &lt;b&gt;</td>');
    expect(frontMatterHtml('# No front matter')).toBe('');
  });
  it('escapes HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('unicode-range filter for embedded fonts', () => {
  it('keeps Latin subsets only', () => {
    expect(coversLatin('U+0-FF, U+131, U+152-153')).toBe(true);
    expect(coversLatin('U+100-2BA, U+2BD-2C5')).toBe(true);
    expect(coversLatin('U+400-45F, U+490-491')).toBe(false);
    expect(coversLatin('')).toBe(true);
  });
});
