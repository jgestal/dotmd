import { describe, expect, it } from 'vitest';
import { slideAt, splitSlides } from '../slides';

function dom(html: string) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
}

describe('slides', () => {
  const html = `
    <h1 data-sourcepos="1:1-1:7">Deck</h1><p data-sourcepos="2:1-2:9">Subtitle</p>
    <hr data-sourcepos="4:1-4:3">
    <h2 data-sourcepos="6:1-6:9">Agenda</h2><ul data-sourcepos="7:1-9:5"><li>One</li><li>Two</li></ul>
    <p data-sourcepos="11:1-11:20">Note: say hello first</p><p data-sourcepos="12:1-12:5">More notes</p>
    <hr data-sourcepos="14:1-14:3">
    <hr data-sourcepos="16:1-16:3">
    <pre data-sourcepos="18:1-20:3"><code>code</code></pre>`;

  it('splits at thematic breaks and skips empty slides', () => {
    const s = splitSlides(dom(html));
    expect(s.length).toBe(3);
    expect(s.map((x) => x.line)).toEqual([1, 6, 18]);
  });

  it('separates speaker notes from the slide', () => {
    const s = splitSlides(dom(html))[1];
    expect(s.html).toContain('Agenda');
    expect(s.html).not.toContain('Note:');
    expect(s.notes).toContain('say hello first');
    expect(s.notes).not.toMatch(/Note:/);
    expect(s.notes).toContain('More notes');
  });

  it('recognises title slides', () => {
    expect(splitSlides(dom(html)).map((x) => x.kind)).toEqual(['title', 'content', 'content']);
  });

  it('keeps a slide that only has an image', () => {
    expect(splitSlides(dom('<p><img src="a.png"></p>')).length).toBe(1);
  });

  it('finds the slide under a source line', () => {
    const s = splitSlides(dom(html));
    expect(slideAt(s, 1)).toBe(0);
    expect(slideAt(s, 8)).toBe(1);
    expect(slideAt(s, 99)).toBe(2);
  });
});
