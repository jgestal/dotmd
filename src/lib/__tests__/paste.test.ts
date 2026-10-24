import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, isUrl, linkFromPaste, shouldConvertHtml } from '../paste';

describe('htmlToMarkdown', () => {
  it('converts web content to Markdown', () => {
    const md = htmlToMarkdown('<h2>Title</h2><p>Some <strong>bold</strong>, <em>italic</em> and <a href="https://x.y">a link</a>.</p><ul><li>one</li><li>two</li></ul>');
    expect(md).toBe('## Title\n\nSome **bold**, *italic* and [a link](https://x.y).\n\n- one\n- two');
  });
  it('normalises ordered lists too', () => {
    expect(htmlToMarkdown('<ol><li>a</li><li>b</li></ol>')).toBe('1. a\n2. b');
  });
  it('converts tables with the GFM plugin', () => {
    const md = htmlToMarkdown('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
    expect(md).toContain('| A | B |');
    expect(md).toContain('| 1 | 2 |');
  });
  it('keeps code blocks fenced and drops scripts', () => {
    const md = htmlToMarkdown('<pre><code>let x = 1;</code></pre><script>alert(1)</script>');
    expect(md).toContain('```\nlet x = 1;\n```');
    expect(md).not.toContain('alert');
  });
});

describe('shouldConvertHtml', () => {
  it('converts structured rich text', () => {
    expect(shouldConvertHtml('<p>a</p><p>b</p>', 'a\nb')).toBe(true);
    expect(shouldConvertHtml('<span>word <a href="x">link</a></span>', 'word link')).toBe(true);
  });
  it('leaves plain or code-editor clipboards alone', () => {
    expect(shouldConvertHtml('', 'x')).toBe(false);
    expect(shouldConvertHtml('<span style="color:red">x</span>', 'x')).toBe(false);
    expect(shouldConvertHtml('<meta charset="utf-8"><div style="font-family: Menlo, monospace"><div><span>const</span></div><br></div>', 'const\n')).toBe(false);
    expect(shouldConvertHtml('<div class="monaco-editor"><p>x</p></div>', 'x\ny')).toBe(false);
  });
});

describe('links from paste', () => {
  it('wraps a selection when a URL is pasted', () => {
    expect(linkFromPaste('DotMD', 'https://github.com/jgestal/dotmd')).toBe('[DotMD](https://github.com/jgestal/dotmd)');
  });
  it('ignores non-URLs, empty or multi-line selections', () => {
    expect(linkFromPaste('', 'https://x.y')).toBeNull();
    expect(linkFromPaste('a\nb', 'https://x.y')).toBeNull();
    expect(linkFromPaste('text', 'not a url')).toBeNull();
    expect(isUrl('mailto:a@b.c')).toBe(true);
  });
});
