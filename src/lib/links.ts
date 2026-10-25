// Links written in the text: finding the one under the caret or the mouse.

/** The link target under a column of a line: [text](target), <url> or a bare URL. */
export function linkAt(line: string, col: number): string | null {
  const patterns = [/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, /<((?:https?|mailto):[^>\s]+)>/g, /\b((?:https?:\/\/|www\.)[^\s<>()\]]+[^\s<>()\].,;:!?'"])/g];
  for (const re of patterns) {
    for (const m of line.matchAll(re)) {
      if (col >= m.index! && col <= m.index! + m[0].length) return m[1].startsWith('www.') ? `https://${m[1]}` : m[1];
    }
  }
  return null;
}
