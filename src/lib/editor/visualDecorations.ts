// GitHub callouts and ==highlight== in the WYSIWYG editor. Like Obsidian's live preview, these are
// decorations: the document (and so the saved Markdown) is untouched, only its rendering changes.
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import type { Node as PMNode } from '@milkdown/kit/prose/model';

const ALERT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i;
const HIGHLIGHT = /==(?=\S)([^=\n]*?\S)==/g;

export function buildDecorations(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'blockquote') {
      const first = node.firstChild;
      const m = first?.textContent.match(ALERT);
      if (m) {
        const kind = m[1].toLowerCase();
        decos.push(Decoration.node(pos, pos + node.nodeSize, { class: `markdown-alert markdown-alert-${kind}` }));
        // Text of the first paragraph starts at pos + 2 (blockquote open + paragraph open).
        decos.push(Decoration.inline(pos + 2, pos + 2 + m[0].length, { class: 'alert-marker', 'data-kind': m[1].toUpperCase() }));
      }
      return true;
    }
    if (!node.isText) return true; // descend into paragraphs, list items, cells…
    if (!node.text || node.marks.some((mk) => mk.type.name === 'inlineCode' || mk.type.name === 'code')) return false;
    for (const m of node.text.matchAll(HIGHLIGHT)) {
      const from = pos + m.index!;
      const to = from + m[0].length;
      decos.push(Decoration.inline(from, to, { class: 'mdv-highlight' }));
      decos.push(Decoration.inline(from, from + 2, { class: 'mdv-syntax' }));
      decos.push(Decoration.inline(to - 2, to, { class: 'mdv-syntax' }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

const key = new PluginKey<DecorationSet>('dotmd-decorations');

export const visualDecorations = $prose(
  () =>
    new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => buildDecorations(state.doc),
        apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old),
      },
      props: { decorations: (state) => key.getState(state) },
    }),
);
