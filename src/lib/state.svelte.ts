import type { FormatAction } from './snippets';

export type Mode = 'preview' | 'source' | 'split' | 'visual';
export type FocusMode = 'off' | 'line' | 'sentence' | 'paragraph';
export type StatKey =
  | 'words' | 'chars' | 'charsNoSpaces' | 'letters' | 'sentences'
  | 'paragraphs' | 'lines' | 'reading' | 'speaking' | 'selection' | 'goal' | 'session';

export interface Settings {
  lang: 'en' | 'es';
  theme: string;
  accent: string;
  docFont: string;
  headingFont: string;
  codeFont: string;
  fontSize: number;
  lineHeight: number;
  docWidth: number;
  paragraphSpacing: number;
  justify: boolean;
  hyphenate: boolean;
  defaultMode: Mode;
  showToolbar: boolean;
  showStats: boolean;
  stats: Record<StatKey, boolean>;
  wordGoal: number;
  readingWpm: number;
  sidebarSide: 'left' | 'right';
  sidebarWidth: number;
  /** Width of the source pane in split mode (0.2–0.8). */
  splitRatio: number;
  showAllFiles: boolean;
  lineNumbers: boolean;
  lineWrap: boolean;
  spellcheck: boolean;
  autosave: boolean;
  focusMode: FocusMode;
  focusOnlyZen: boolean;
  typewriterScroll: boolean;
  typewriterOnlyZen: boolean;
  zenFullscreen: boolean;
  zenShowStats: boolean;
  typingSound: 'off' | 'typewriter' | 'soft' | 'mechanical';
  soundVolume: number;
  soundOnlyZen: boolean;
  /** Ring the margin bell when the caret reaches this column (0 = never). */
  bellColumn: number;
  /** Pan each key strike by its position on the keyboard. */
  stereoKeys: boolean;
  /** Settings saved when "Typewriter mode" was switched on, restored when it is switched off. */
  typewriterPrev: Partial<Settings> | null;
  crtScanlines: boolean;
  crtGlow: boolean;
  crtFlicker: boolean;
  crtCurvature: boolean;
  paperTexture: boolean;
  inkVariation: boolean;
  pdfPageSize: 'A4' | 'Letter' | 'A5' | 'Legal';
  pdfMargin: number;
  exportTheme: 'current' | 'modern' | 'github' | 'paper' | 'typewriter';
  customCss: string;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  theme: 'auto',
  accent: '',
  docFont: 'theme',
  headingFont: 'theme',
  codeFont: 'theme',
  fontSize: 16,
  lineHeight: 1.65,
  docWidth: 760,
  paragraphSpacing: 1,
  justify: false,
  hyphenate: false,
  defaultMode: 'preview',
  showToolbar: true,
  showStats: true,
  stats: {
    words: true, chars: true, charsNoSpaces: false, letters: true, sentences: false,
    paragraphs: false, lines: false, reading: true, speaking: false, selection: true, goal: true, session: false,
  },
  wordGoal: 0,
  readingWpm: 230,
  sidebarSide: 'left',
  sidebarWidth: 260,
  splitRatio: 0.5,
  showAllFiles: false,
  lineNumbers: false,
  lineWrap: true,
  spellcheck: true,
  autosave: false,
  focusMode: 'paragraph',
  focusOnlyZen: true,
  typewriterScroll: true,
  typewriterOnlyZen: true,
  zenFullscreen: true,
  zenShowStats: true,
  typingSound: 'off',
  soundVolume: 0.5,
  soundOnlyZen: false,
  bellColumn: 65,
  stereoKeys: true,
  typewriterPrev: null,
  crtScanlines: true,
  crtGlow: true,
  crtFlicker: false,
  crtCurvature: true,
  paperTexture: true,
  inkVariation: true,
  pdfPageSize: 'A4',
  pdfMargin: 18,
  exportTheme: 'current',
  customCss: '',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return parsed;
    return { ...structuredClone(fallback), ...parsed, ...(key === 'dotmd.settings' ? { stats: { ...(fallback as any).stats, ...parsed.stats } } : {}) };
  } catch {
    return structuredClone(fallback);
  }
}

function initialLang(): 'en' | 'es' {
  return 'en'; // English by default; Spanish is opt-in from Settings.
}

export const settings: Settings = $state(load('dotmd.settings', { ...DEFAULT_SETTINGS, lang: initialLang() }));

export const session = $state(
  load('dotmd.session', { lastFolder: null as string | null, lastFile: null as string | null, recent: [] as string[], expanded: [] as string[] }),
);

export const app = $state({
  path: null as string | null,
  /** A document (saved or untitled) is open; false shows the welcome screen. */
  docOpen: false,
  content: '',
  saved: '',
  /** Bumped whenever content is replaced from outside the editors (open, reload, checkbox). */
  extVersion: 0,
  mode: 'preview' as Mode,
  root: null as string | null,
  sidebar: true,
  sidebarTab: 'files' as 'files' | 'outline',
  zen: false,
  selection: '',
  settingsOpen: false,
  paletteOpen: false,
  exportOpen: false,
  dragOver: false,
  treeVersion: 0,
  sessionStartWords: -1,
  toast: '' as string,
  systemDark: false,
  /** Line the editor/preview should reveal (outline clicks). */
  reveal: { line: 0, n: 0 },
});

export const isDirty = () => app.content !== app.saved;

$effect.root(() => {
  $effect(() => {
    try { localStorage.setItem('dotmd.settings', JSON.stringify(settings)); } catch {}
  });
  $effect(() => {
    try { localStorage.setItem('dotmd.session', JSON.stringify(session)); } catch {}
  });
});

/** The editor currently mounted registers itself here so the toolbar can drive it. */
export interface EditorApi {
  exec(action: FormatAction): void;
  focus(): void;
  revealLine?(line: number): void;
}
let editorApi: EditorApi | null = null;
export const setEditorApi = (api: EditorApi | null) => (editorApi = api);
export const getEditorApi = () => editorApi;

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, ms = 2600) {
  app.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (app.toast = ''), ms);
}

export function setContent(text: string, saved = true) {
  app.content = text;
  if (saved) app.saved = text;
  app.extVersion++;
}

export function pushRecent(path: string) {
  session.recent = [path, ...session.recent.filter((p) => p !== path)].slice(0, 12);
}

export const focusActive = () => settings.focusMode !== 'off' && (!settings.focusOnlyZen || app.zen);
export const typewriterActive = () => settings.typewriterScroll && (!settings.typewriterOnlyZen || app.zen);
export const soundActive = () => settings.typingSound !== 'off' && (!settings.soundOnlyZen || app.zen);
