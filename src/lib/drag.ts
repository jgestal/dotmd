// Pointer-based drag and drop for in-app moves (tree rows, tabs). HTML5 drag events are unreliable
// inside the Tauri webview when OS file drops are enabled (notably on Windows), so we track the pointer.

interface DragOptions {
  /** Text shown next to the cursor while dragging. */
  label: string;
  /** CSS selector of valid drop targets. */
  target: string;
  onOver?: (el: HTMLElement | null) => void;
  onDrop: (el: HTMLElement) => void;
}

export function pointerDrag(down: PointerEvent, o: DragOptions) {
  if (down.button !== 0) return;
  const x0 = down.clientX, y0 = down.clientY;
  let ghost: HTMLElement | null = null;
  let over: HTMLElement | null = null;

  const setOver = (el: HTMLElement | null) => {
    if (el === over) return;
    over?.classList.remove('drop-target');
    over = el;
    over?.classList.add('drop-target');
    o.onOver?.(over);
  };

  const move = (e: PointerEvent) => {
    if (!ghost) {
      if (Math.hypot(e.clientX - x0, e.clientY - y0) < 5) return;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = o.label;
      document.body.appendChild(ghost);
      document.body.classList.add('dragging');
    }
    ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 8}px)`;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    setOver((hit?.closest(o.target) as HTMLElement | null) ?? null);
  };

  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', cancel, true);
    if (!ghost) return;
    ghost.remove();
    document.body.classList.remove('dragging');
    const target = over;
    setOver(null);
    // Swallow the click that follows the drop so the dragged row is not also "opened".
    window.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
    if (target) o.onDrop(target);
  };

  const cancel = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    over = null;
    setOver(null);
    ghost?.remove();
    ghost = null;
    document.body.classList.remove('dragging');
    up();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', cancel, true);
}
