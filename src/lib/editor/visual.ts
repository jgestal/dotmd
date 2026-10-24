import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { callCommand, insert, replaceAll } from '@milkdown/kit/utils';
import {
  toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand, wrapInHeadingCommand,
  wrapInBlockquoteCommand, wrapInBulletListCommand, wrapInOrderedListCommand, turnIntoTextCommand, toggleLinkCommand,
} from '@milkdown/kit/preset/commonmark';
import { toggleStrikethroughCommand, insertTableCommand } from '@milkdown/kit/preset/gfm';
import { convertFileSrc } from '@tauri-apps/api/core';
import katex from 'katex';
import { blockMarkdown, today, type FormatAction } from '../snippets';
import { isAbsolute, join } from '../path';
import { mermaidSvg } from '../render';
import type { Theme } from '../themes';

export interface VisualOptions {
  doc: string;
  dir: () => string | null;
  theme: () => Theme;
  placeholder: string;
  onChange: (md: string) => void;
  onKey: (key: string, column: number) => void;
}

/** WYSIWYG editor (Milkdown/ProseMirror). Edits the formatted document and serializes back to Markdown. */
/** Characters between the start of the caret's block (paragraph, heading, list item) and the caret. */
function caretColumn(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return 0;
  const caret = sel.getRangeAt(0);
  let block = caret.startContainer as Node | null;
  while (block && !(block instanceof HTMLElement && /^(P|H[1-6]|LI|PRE|BLOCKQUOTE|TD|TH)$/.test(block.tagName))) {
    if (block === root) return 0;
    block = block.parentNode;
  }
  if (!block) return 0;
  const r = document.createRange();
  r.setStart(block, 0);
  r.setEnd(caret.startContainer, caret.startOffset);
  return r.toString().length;
}

/** Front matter is kept out of the WYSIWYG document (ProseMirror would mangle it) and re-attached on output. */
function splitFrontMatter(md: string): [string, string] {
  const m = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return m ? [m[0], md.slice(m[0].length)] : ['', md];
}

export async function createVisual(root: HTMLElement, o: VisualOptions) {
  let suppress = true;
  let [front, body] = splitFrontMatter(o.doc);
  /** Milkdown's serialization of the untouched document; equal output means "no user edit". */
  let baseline: string | null = null;
  const crepe = new Crepe({
    root,
    defaultValue: body,
    features: { [Crepe.Feature.AI]: false, [Crepe.Feature.TopBar]: false },
    featureConfigs: {
      [Crepe.Feature.Placeholder]: { text: o.placeholder, mode: 'doc' },
      [Crepe.Feature.ImageBlock]: {
        proxyDomURL: (url: string) => {
          if (/^(https?:|data:|blob:|asset:)/.test(url)) return url;
          const dir = o.dir();
          const p = decodeURI(url);
          return isAbsolute(p) ? convertFileSrc(p) : dir ? convertFileSrc(join(dir, p)) : url;
        },
      },
      [Crepe.Feature.CodeMirror]: {
        renderPreview: (language: string, content: string, apply: (v: null | string | HTMLElement) => void) => {
          const lang = language.toLowerCase();
          if (lang === 'mermaid' && content.trim()) {
            mermaidSvg(content, o.theme()).then((svg) => apply(svg));
            return undefined;
          }
          if ((lang === 'math' || lang === 'latex' || lang === 'tex') && content.trim()) {
            return katex.renderToString(content, { displayMode: true, throwOnError: false });
          }
          return null;
        },
      },
    },
  });
  crepe.on((api) => {
    api.markdownUpdated((_ctx, md) => {
      if (suppress || md === baseline) return;
      o.onChange(front + md);
    });
  });
  await crepe.create();
  baseline = crepe.getMarkdown();
  suppress = false;
  root.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || !(e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace')) return;
    const col = caretColumn(root);
    o.onKey(e.key, e.key.length === 1 ? col + 1 : e.key === 'Backspace' ? Math.max(0, col - 1) : 0);
  });

  const run = (fn: (ctx: any) => unknown) => crepe.editor.action(fn as any);
  const cmd = (key: any, payload?: unknown) => run(callCommand(key, payload as any));

  function exec(a: FormatAction) {
    switch (a.type) {
      case 'bold': cmd(toggleStrongCommand.key); break;
      case 'italic': cmd(toggleEmphasisCommand.key); break;
      case 'strike': cmd(toggleStrikethroughCommand.key); break;
      case 'code': cmd(toggleInlineCodeCommand.key); break;
      case 'highlight': run(insert('==text==', true)); break;
      case 'heading': cmd(wrapInHeadingCommand.key, a.level); break;
      case 'paragraph': cmd(turnIntoTextCommand.key); break;
      case 'quote': cmd(wrapInBlockquoteCommand.key); break;
      case 'ul': cmd(wrapInBulletListCommand.key); break;
      case 'ol': cmd(wrapInOrderedListCommand.key); break;
      case 'task': run(insert('- [ ] ')); break;
      case 'table': cmd(insertTableCommand.key, { row: a.rows, col: a.cols }); break;
      case 'link': {
        const sel = window.getSelection()?.toString();
        if (sel) cmd(toggleLinkCommand.key, { href: a.url });
        else run(insert(`[${a.text || a.url}](${a.url})`, true));
        break;
      }
      case 'date': run(insert(today(), true)); break;
      case 'footnote': run(insert('[^1]', true)); break;
      case 'formatTable': break;
      default: {
        const md = blockMarkdown(a);
        if (md) run(insert(md));
      }
    }
  }

  return {
    exec,
    getMarkdown: () => front + crepe.getMarkdown(),
    setDoc(md: string) {
      suppress = true;
      try {
        [front, body] = splitFrontMatter(md);
        run(replaceAll(body));
        baseline = crepe.getMarkdown();
      } finally { suppress = false; }
    },
    focus: () => (root.querySelector('.ProseMirror') as HTMLElement | null)?.focus(),
    destroy: () => crepe.destroy(),
  };
}
