import { describe, expect, it } from 'vitest';
import { Schema } from '@milkdown/kit/prose/model';
import { buildDecorations } from '../editor/visualDecorations';

// A tiny schema with the node/mark names Milkdown uses.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    blockquote: { group: 'block', content: 'block+' },
    text: { group: 'inline' },
  },
  marks: { inlineCode: {} },
});
const p = (...c: any[]) => schema.node('paragraph', null, c);
const txt = (s: string, marks: any[] = []) => schema.text(s, marks);

describe('visual decorations', () => {
  it('marks GitHub callouts', () => {
    const doc = schema.node('doc', null, [schema.node('blockquote', null, [p(txt('[!WARNING] Careful'))])]);
    const found = buildDecorations(doc).find();
    expect(found.some((d) => (d as any).type.attrs.class === 'markdown-alert markdown-alert-warning')).toBe(true);
    const marker = found.find((d) => (d as any).type.attrs.class === 'alert-marker')!;
    expect(doc.textBetween(marker.from, marker.to)).toBe('[!WARNING]');
  });
  it('ignores plain quotes', () => {
    const doc = schema.node('doc', null, [schema.node('blockquote', null, [p(txt('Just a quote'))])]);
    expect(buildDecorations(doc).find()).toHaveLength(0);
  });
  it('highlights ==text== but not inside code', () => {
    const doc = schema.node('doc', null, [p(txt('a ==hi there== b')), p(txt('==no==', [schema.mark('inlineCode')]))]);
    const hl = buildDecorations(doc).find().filter((d) => (d as any).type.attrs.class === 'mdv-highlight');
    expect(hl).toHaveLength(1);
    expect(doc.textBetween(hl[0].from, hl[0].to)).toBe('==hi there==');
  });
});
