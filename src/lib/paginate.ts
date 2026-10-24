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

/**
 * Moves `nodes` into page sheets appended to `container` (which must be in the DOM so heights can
 * be measured). A block that does not fit starts the next page; a heading is never left alone at the
 * bottom of a page; `.page-break` elements force a new page. Blocks taller than a page keep their
 * own page and simply overflow it. Returns the number of pages.
 */
export function paginate(container: HTMLElement, nodes: Node[]): number {
  let inner = newPage(container);
  let pages = 1;
  const next = () => {
    inner = newPage(container);
    pages++;
  };
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    if (node instanceof HTMLElement && node.classList.contains('page-break')) {
      if (inner.childNodes.length) next();
      continue;
    }
    inner.appendChild(node);
    if (inner.scrollHeight <= inner.clientHeight + 1 || inner.childNodes.length === 1) continue;
    // Overflow: move the block (and a heading right above it) to a fresh page.
    inner.removeChild(node);
    const prev = inner.lastElementChild;
    const carry = prev && HEADING.test(prev.tagName) && inner.childNodes.length > 1 ? prev : null;
    carry?.remove();
    next();
    if (carry) inner.appendChild(carry);
    inner.appendChild(node);
  }
  const sheets = container.querySelectorAll<HTMLElement>(':scope > .page');
  sheets.forEach((p, i) => p.setAttribute('data-page', `${i + 1} / ${pages}`));
  return pages;
}
