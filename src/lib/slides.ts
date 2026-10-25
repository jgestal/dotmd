// Presentations from ordinary Markdown: `---` (a thematic break) starts a new slide, and a
// paragraph starting with "Note:" begins the speaker notes of that slide (reveal.js convention).

export interface Slide {
  html: string;
  notes: string;
  /** A slide made only of headings (and at most one short line) is laid out as a title slide. */
  kind: 'title' | 'content';
  /** First source line of the slide, to start presenting where the caret is. */
  line: number;
}

const NOTE = /^\s*notes?\s*:/i;

const lineOf = (el: Element | null) => Number(el?.getAttribute('data-sourcepos')?.split(':')[0] ?? 0) || 0;

/** Splits rendered Markdown (the comrak HTML, top-level elements) into slides. */
export function splitSlides(root: Element): Slide[] {
  const groups: { els: Element[]; hr: Element | null }[] = [{ els: [], hr: null }];
  for (const el of [...root.children]) {
    if (el.tagName === 'HR') groups.push({ els: [], hr: el });
    else groups[groups.length - 1].els.push(el);
  }
  const slides: Slide[] = [];
  for (const g of groups) {
    const noteAt = g.els.findIndex((el) => el.tagName === 'P' && NOTE.test(el.textContent ?? ''));
    const body = noteAt >= 0 ? g.els.slice(0, noteAt) : g.els;
    const notes = noteAt >= 0 ? g.els.slice(noteAt) : [];
    if (!body.some((el) => (el.textContent ?? '').trim() || el.querySelector('img, svg, table, .mermaid-diagram'))) continue;
    if (notes[0]) notes[0].innerHTML = notes[0].innerHTML.replace(/^\s*notes?\s*:\s*/i, '');
    const headings = body.filter((el) => /^H[1-6]$/.test(el.tagName));
    const others = body.filter((el) => !/^H[1-6]$/.test(el.tagName));
    const title = headings.length > 0 && others.length <= 1 && others.every((el) => el.tagName === 'P' && (el.textContent ?? '').length < 140);
    slides.push({
      html: body.map((el) => el.outerHTML).join('\n'),
      notes: notes.map((el) => el.outerHTML).join('\n'),
      kind: title ? 'title' : 'content',
      line: lineOf(body[0]) || lineOf(g.hr) + 1,
    });
  }
  return slides;
}

/** Index of the slide that contains a source line (the last one starting at or before it). */
export function slideAt(slides: Slide[], line: number): number {
  let i = 0;
  slides.forEach((s, k) => { if (s.line && s.line <= line) i = k; });
  return i;
}

/** Shrinks the text of a slide until it fits its box (long slides stay readable, never cut). */
export function fitSlide(el: HTMLElement, minScale = 0.45) {
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  let scale = 1;
  while (scale > minScale && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
    scale *= 0.92;
    el.style.fontSize = `${base * scale}px`;
  }
}
