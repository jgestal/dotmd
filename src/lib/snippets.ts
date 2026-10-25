// Formatting actions shared by the toolbar, shortcuts and both editors.

export type FormatAction =
  | { type: 'bold' | 'italic' | 'strike' | 'code' | 'highlight' }
  | { type: 'heading'; level: number }
  | { type: 'paragraph' }
  | { type: 'quote' | 'ul' | 'ol' | 'task' }
  | { type: 'link'; url: string; text: string }
  | { type: 'image'; src: string; alt: string }
  | { type: 'table'; rows: number; cols: number }
  | { type: 'codeblock'; lang: string }
  | { type: 'mermaid'; template: string }
  | { type: 'math' }
  | { type: 'hr' }
  | { type: 'footnote' }
  | { type: 'alert'; kind: string }
  | { type: 'details' }
  | { type: 'pagebreak' }
  | { type: 'date'; long?: boolean }
  | { type: 'formatTable' };

export function tableMarkdown(rows: number, cols: number, header = 'Column'): string {
  const head = Array.from({ length: cols }, (_, i) => `${header} ${i + 1}`);
  const w = head.map((h) => h.length);
  const line = (cells: string[]) => '| ' + cells.map((c, i) => c.padEnd(w[i])).join(' | ') + ' |';
  const out = [line(head), '| ' + w.map((n) => '-'.repeat(n)).join(' | ') + ' |'];
  for (let r = 0; r < Math.max(1, rows - 1); r++) out.push(line(head.map(() => '')));
  return out.join('\n');
}

export const MERMAID_TEMPLATES: Record<string, string> = {
  flowchart: 'flowchart LR\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Do it]\n  B -->|No| D[Skip]\n  C --> E[End]\n  D --> E',
  sequence: 'sequenceDiagram\n  participant A as Alice\n  participant B as Bob\n  A->>B: Hello Bob\n  B-->>A: Hi Alice!',
  class: 'classDiagram\n  class Animal {\n    +String name\n    +move()\n  }\n  class Dog\n  Animal <|-- Dog',
  state: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> Published\n  Published --> [*]',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE_ITEM : contains',
  gantt: 'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Phase 1\n  Design :a1, 2026-01-01, 7d\n  Build  :after a1, 14d',
  pie: 'pie title Time\n  "Writing" : 60\n  "Editing" : 30\n  "Coffee" : 10',
  mindmap: 'mindmap\n  root((Idea))\n    Goals\n    Risks\n    Next steps',
  timeline: 'timeline\n  title Project\n  2026 : Start\n  2027 : Launch',
  journey: 'journey\n  title Writing a post\n  section Draft\n    Outline: 4: Me\n    Write: 3: Me',
};

export const CODE_LANGS = ['', 'bash', 'c', 'cpp', 'csharp', 'css', 'go', 'html', 'java', 'javascript', 'json', 'kotlin', 'python', 'rust', 'sql', 'swift', 'typescript', 'yaml'];

export const ALERT_KINDS = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

/** Markdown for block-level inserts; inline marks are handled by each editor. */
export function blockMarkdown(a: FormatAction): string | null {
  switch (a.type) {
    case 'table': return tableMarkdown(a.rows, a.cols);
    case 'codeblock': return '```' + a.lang + '\n\n```';
    case 'mermaid': return '```mermaid\n' + (MERMAID_TEMPLATES[a.template] ?? MERMAID_TEMPLATES.flowchart) + '\n```';
    case 'math': return '$$\nE = mc^2\n$$';
    case 'hr': return '---';
    case 'alert': return `> [!${a.kind}]\n> `;
    case 'pagebreak': return '<div class="page-break"></div>';
    case 'details': return '<details>\n<summary>Summary</summary>\n\nHidden content.\n\n</details>';
    case 'image': return `![${a.alt}](${encodeURI(a.src)})`;
    default: return null;
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
/** Today written out in the UI language ("25 de octubre de 2026", "October 25, 2026"). */
export const longDate = (lang = typeof document !== 'undefined' ? document.documentElement.lang || undefined : undefined) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date());

/** Re-aligns a GFM table so every column has the same width. */
export function formatTable(lines: string[]): string[] {
  const rows = lines.map((l) =>
    l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim()),
  );
  const cols = Math.max(...rows.map((r) => r.length));
  const isSep = (r: string[]) => r.every((c) => /^:?-+:?$/.test(c) || c === '');
  const width = Array.from({ length: cols }, (_, i) =>
    Math.max(3, ...rows.filter((r) => !isSep(r)).map((r) => [...(r[i] ?? '')].length)),
  );
  return rows.map((r) => {
    if (isSep(r)) {
      return '| ' + width.map((w, i) => {
        const c = r[i] ?? '';
        const left = c.startsWith(':'), right = c.endsWith(':');
        return (left ? ':' : '-') + '-'.repeat(Math.max(1, w - 2)) + (right ? ':' : '-');
      }).join(' | ') + ' |';
    }
    return '| ' + width.map((w, i) => {
      const c = r[i] ?? '';
      return c + ' '.repeat(Math.max(0, w - [...c].length));
    }).join(' | ') + ' |';
  });
}
