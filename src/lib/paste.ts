// Smart paste, as Typora and Obsidian do it: rich text copied from a web page or a word processor
// becomes Markdown, and a URL pasted over selected text becomes a link.
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let turndown: TurndownService | null = null;

function service(): TurndownService {
  if (turndown) return turndown;
  turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  turndown.use(gfm);
  // Drop things that never make sense in a Markdown document.
  turndown.remove(['script', 'style', 'meta', 'title', 'head' as keyof HTMLElementTagNameMap]);
  return turndown;
}

/** Elements that carry document structure; HTML with none of them is styled plain text. */
const STRUCTURE = /<(h[1-6]|p|ul|ol|li|table|blockquote|pre|a\s|img|strong|b>|em|i>|code|hr|br)/i;

/**
 * Whether pasted HTML should be converted. Code editors (VS Code, JetBrains, Xcode) put coloured
 * spans on the clipboard: converting those would mangle the code, so plain text wins there.
 */
export function shouldConvertHtml(html: string, text: string): boolean {
  if (!html || !STRUCTURE.test(html)) return false;
  if (/vscode|monaco|jetbrains|xcode|data-code/i.test(html)) return false;
  if (/^\s*<(meta[^>]*>\s*)?<(div|pre)[^>]*style="[^"]*(monospace|Menlo|Consolas|Courier)/i.test(html)) return false;
  // One-line selections (a word from a page) are better pasted as they are.
  return text.includes('\n') || /<(a\s|img|strong|b>|em|code)/i.test(html);
}

export function htmlToMarkdown(html: string): string {
  return service()
    .turndown(html)
    .replace(/^(\s*)([-*+]|\d+\.)\s{2,}/gm, '$1$2 ') // "-   item" → "- item"
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const URL_RE = /^(https?:\/\/|mailto:)[^\s<>"]+$/i;
export const isUrl = (s: string) => URL_RE.test(s.trim());

/** "[selected text](url)" when a URL is pasted over a selection, else null. */
export function linkFromPaste(selection: string, pasted: string): string | null {
  if (!selection || selection.includes('\n') || !isUrl(pasted) || isUrl(selection)) return null;
  return `[${selection}](${pasted.trim()})`;
}
