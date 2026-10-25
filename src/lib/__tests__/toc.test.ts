import { describe, expect, it } from 'vitest';
import { applyToc, slug, tocList, hasToc } from '../toc';

describe('slug', () => {
  it('matches GitHub/comrak anchors', () => {
    expect(slug('Hello, World!')).toBe('hello-world');
    expect(slug('Capítulo 2: Año')).toBe('capítulo-2-año');
    expect(slug('a  b')).toBe('a--b');
  });
});

describe('tocList', () => {
  const md = '# Title\n\n## One\n\n### One A\n\n```\n## not a heading\n```\n\n## Two **bold**\n\n## One\n';
  it('lists headings below the title, nested, skipping code, de-duplicating anchors', () => {
    expect(tocList(md)).toBe('- [One](#one)\n  - [One A](#one-a)\n- [Two bold](#two-bold)\n- [One](#one-1)');
  });
});

describe('applyToc', () => {
  it('inserts after front matter and title', () => {
    const out = applyToc('---\ntitle: x\n---\n# Title\n\nIntro.\n\n## A\n');
    expect(out).toBe('---\ntitle: x\n---\n# Title\n\n<!-- toc -->\n- [A](#a)\n<!-- tocstop -->\n\nIntro.\n\n## A\n');
    expect(hasToc(out)).toBe(true);
  });
  it('updates an existing TOC in place', () => {
    const first = applyToc('# T\n\n## A\n');
    const second = applyToc(first + '\n## B\n');
    expect(second.match(/<!-- toc -->/g)).toHaveLength(1);
    expect(second).toContain('- [A](#a)\n- [B](#b)');
  });
  it('works without a title', () => {
    expect(applyToc('## A\n\n## B')).toBe('<!-- toc -->\n- [A](#a)\n- [B](#b)\n<!-- tocstop -->\n\n## A\n\n## B');
  });
});
