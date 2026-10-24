// Page view: lays the rendered document out on sheets with the export paper size and margins,
// so what you read is what the PDF will look like.

/** Paper sizes in millimetres (portrait). */
export const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
};

const HEADING = /^H[1-6]$/;

function newPage(container: HTMLElement): HTMLElement {
  const page = document.createElement('section');
  page.className = 'page';
  const inner = document.createElement('div');
  inner.className = 'page-inner';
  page.appendChild(inner);
  container.appendChild(page);
  return inner;
}

interface Box { node: Node; top: number; bottom: number; heading: boolean; brk: boolean }

/**
 * Assigns blocks to pages from their measured positions (pure arithmetic, so it is unit-testable).
 * A block that does not fit starts the next page; a heading is never left alone at the bottom of a
 * page; page breaks force a new page; a block taller than a page gets a page of its own.
 */
export function assignPages(boxes: Omit<Box, 'node'>[], pageHeight: number): number[] {
  const page: number[] = [];
  let current = 0;
  let start = -1; // top of the first block on the current page
  let onlyHeadings = true; // the current page holds nothing but headings so far
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (b.brk) {
      if (start >= 0) { current++; start = -1; onlyHeadings = true; }
      page.push(-1);
      continue;
    }
    if (start < 0) start = b.top;
    // A block taller than any page stays under the heading that introduces it.
    const tallAfterHeading = onlyHeadings && b.bottom - b.top > pageHeight;
    if (b.bottom - start > pageHeight + 1 && b.top > start && !tallAfterHeading) {
      onlyHeadings = true;
      current++;
      start = b.top;
      // Keep a heading with the block it introduces.
      const prev = i - 1;
      if (prev >= 0 && boxes[prev].heading && page[prev] === current - 1 && prev > 0 && page[prev - 1] === current - 1) {
        page[prev] = current;
        start = boxes[prev].top;
      }
    }
    page.push(current);
    if (!b.heading) onlyHeadings = false;
  }
  return page;
}

/**
 * Moves `nodes` into page sheets appended to `container` (which must be in the DOM). All blocks are
 * measured in one layout pass, as print engines do, then distributed without further reflows.
 * Returns the number of pages.
 */
export function paginate(container: HTMLElement, nodes: Node[]): number {
  const blocks = nodes.filter((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
  // One measuring sheet with the page's width and styles but no height limit.
  const measure = newPage(container);
  const sheet = measure.parentElement!;
  sheet.classList.add('measuring');
  const pageHeight = measure.clientHeight;
  sheet.style.height = 'auto';
  measure.style.height = 'auto';
  for (const n of blocks) measure.appendChild(n);
  const boxes = blocks.map((n) => {
    if (!(n instanceof HTMLElement)) return { top: 0, bottom: 0, heading: false, brk: false };
    return { top: n.offsetTop, bottom: n.offsetTop + n.offsetHeight, heading: HEADING.test(n.tagName), brk: n.classList.contains('page-break') };
  });
  const assignment = assignPages(boxes, pageHeight);
  sheet.remove();

  const inners: HTMLElement[] = [];
  blocks.forEach((n, i) => {
    const p = assignment[i];
    if (p < 0) return; // page breaks are consumed
    while (inners.length <= p) inners.push(newPage(container));
    inners[p].appendChild(n);
  });
  if (!inners.length) inners.push(newPage(container));
  const total = inners.length;
  inners.forEach((inner, i) => inner.parentElement!.setAttribute('data-page', `${i + 1} / ${total}`));
  return total;
}
