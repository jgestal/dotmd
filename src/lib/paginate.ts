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

interface Box {
  top: number;
  bottom: number;
  heading: boolean;
  brk: boolean;
  /** Extra height this box needs when it opens a page (a repeated table header). */
  lead?: number;
}

/**
 * Assigns blocks to pages from their measured positions (pure arithmetic, so it is unit-testable).
 * A block that does not fit starts the next page; a heading is never left alone at the bottom of a
 * page; page breaks force a new page; a block taller than a page gets a page of its own.
 */
export function assignPages(boxes: Box[], pageHeight: number): number[] {
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
    if (start < 0) start = b.top - (b.lead ?? 0);
    // A block taller than any page stays under the heading that introduces it.
    const tallAfterHeading = onlyHeadings && b.bottom - b.top > pageHeight;
    if (b.bottom - start > pageHeight + 1 && b.top > start && !tallAfterHeading) {
      onlyHeadings = true;
      current++;
      start = b.top - (b.lead ?? 0);
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

/** A unit of layout: a whole block, or one row of a table that may continue on the next page. */
interface Unit { node: Node; table?: HTMLTableElement; row?: HTMLTableRowElement }

/**
 * Moves `nodes` into page sheets appended to `container` (which must be in the DOM). All blocks are
 * measured in one layout pass, as print engines do, then distributed without further reflows.
 * Tables are split between rows and their header is repeated on every page they continue on.
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

  const units: Unit[] = [];
  const boxes: Box[] = [];
  const base = measure.getBoundingClientRect().top;
  for (const n of blocks) {
    if (!(n instanceof HTMLElement)) {
      units.push({ node: n });
      boxes.push({ top: 0, bottom: 0, heading: false, brk: false });
      continue;
    }
    const top = n.offsetTop, bottom = n.offsetTop + n.offsetHeight;
    const table = n instanceof HTMLTableElement ? n : null;
    const rows = table ? [...table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr')] : [];
    if (table && rows.length > 1 && bottom - top > pageHeight / 3) {
      const headH = table.tHead?.getBoundingClientRect().height ?? 0;
      rows.forEach((row, i) => {
        const r = row.getBoundingClientRect();
        const rTop = r.top - base + measure.offsetTop, rBottom = r.bottom - base + measure.offsetTop;
        units.push({ node: table, table, row });
        boxes.push({ top: i === 0 ? top : rTop, bottom: i === rows.length - 1 ? bottom : rBottom, heading: false, brk: false, lead: i === 0 ? 0 : headH });
      });
      continue;
    }
    units.push({ node: n });
    boxes.push({ top, bottom, heading: HEADING.test(n.tagName), brk: n.classList.contains('page-break') });
  }
  const assignment = assignPages(boxes, pageHeight);
  sheet.remove();

  const inners: HTMLElement[] = [];
  const pageOf = (p: number) => { while (inners.length <= p) inners.push(newPage(container)); return inners[p]; };
  // Table pieces: the first keeps the original element, later pages get a shell with a copy of the header.
  const pieces = new Map<string, HTMLTableSectionElement>();
  units.forEach((u, i) => {
    const p = assignment[i];
    if (p < 0) return; // page breaks are consumed
    if (!u.table || !u.row) return void pageOf(p).appendChild(u.node);
    const key = `${units.indexOf(units.find((x) => x.table === u.table)!)}:${p}`;
    let body = pieces.get(key);
    if (!body) {
      const first = ![...pieces.keys()].some((k) => k.startsWith(key.split(':')[0] + ':'));
      const shell = first ? u.table : (u.table.cloneNode(false) as HTMLTableElement);
      if (first) {
        // Detach the rows; they are re-added page by page below.
        for (const r of [...u.table.querySelectorAll(':scope > tbody > tr')]) r.remove();
      } else {
        if (u.table.tHead) shell.appendChild(u.table.tHead.cloneNode(true));
        shell.classList.add('table-continued');
      }
      body = shell.tBodies[0] ?? shell.appendChild(document.createElement('tbody'));
      pageOf(p).appendChild(shell);
      pieces.set(key, body);
    }
    body.appendChild(u.row);
  });
  if (!inners.length) inners.push(newPage(container));
  const total = inners.length;
  inners.forEach((inner, i) => inner.parentElement!.setAttribute('data-page', `${i + 1} / ${total}`));
  return total;
}
