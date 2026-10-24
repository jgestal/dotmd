import { describe, expect, it } from 'vitest';
import { assignPages } from '../paginate';

const box = (top: number, h: number, extra: Partial<{ heading: boolean; brk: boolean }> = {}) => ({ top, bottom: top + h, heading: false, brk: false, ...extra });

describe('assignPages', () => {
  it('fills pages in order', () => {
    // 100px pages, 40px blocks spaced by 10px margins.
    const boxes = [box(0, 40), box(50, 40), box(100, 40), box(150, 40)];
    expect(assignPages(boxes, 100)).toEqual([0, 0, 1, 1]);
  });
  it('keeps a heading with the block that follows it', () => {
    const boxes = [box(0, 40), box(50, 20, { heading: true }), box(75, 40)];
    expect(assignPages(boxes, 100)).toEqual([0, 1, 1]);
  });
  it('does not move a heading that is alone on its page', () => {
    const boxes = [box(0, 20, { heading: true }), box(30, 200)];
    expect(assignPages(boxes, 100)).toEqual([0, 0]);
  });
  it('gives a block taller than a page its own page', () => {
    const boxes = [box(0, 30), box(40, 300), box(350, 30)];
    expect(assignPages(boxes, 100)).toEqual([0, 1, 2]);
  });
  it('honours manual page breaks', () => {
    const boxes = [box(0, 10), box(10, 0, { brk: true }), box(20, 10)];
    expect(assignPages(boxes, 100)).toEqual([0, -1, 1]);
  });
});
