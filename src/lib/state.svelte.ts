import type { FormatAction } from './snippets';

export type Mode = 'preview' | 'source' | 'split' | 'visual';

export interface Tab {
  id: number;
  path: string | null;
  content: string;
  saved: string;
  mode: Mode;
  /** Line endings on disk; the editors always work with "\n". */
  crlf: boolean;
}
export type FocusMode = 'off' | 'line' | 'sentence' | 'paragraph';
export type StatKey =
  | 'words' | 'chars' | 'charsNoSpaces' | 'letters' | 'sentences'
  | 'paragraphs' | 'lines' | 'reading' | 'speaking' | 'selection' | 'goal' | 'session';

export interface Settings {
  lang: 'en' | 'es';
  theme: string;
  /** Light/dark for the "Automatic" theme: follow the OS or force one. */
  appearance: 'system' | 'light' | 'dark';
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
  exportTheme: 'current' | 'modern' | 'github' | 'paper' | 'typewriter' | 'tractor';
  /** Inline the theme's font files in exported HTML/PDF. */
  exportEmbedFonts: boolean;
  /** Read/Split preview laid out on paper sheets (export paper size and margins). */
  pageView: boolean;
  autoUpdate: boolean;
  /** "auto" uses the system WebKit where available (macOS) and falls back to Chromium. */
  pdfEngine: 'auto' | 'chromium';
  customCss: string;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en',
  theme: 'auto',
  appearance: 'system',
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
  focusMode: 'line',
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
  exportEmbedFonts: true,
  pageView: false,
  autoUpdate: true,
  pdfEngine: 'auto',
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
  load('dotmd.session', { lastFolder: null as string | null, lastFile: null as string | null, recent: [] as string[], recentFolders: [] as string[], expanded: [] as string[], tabs: [] as string[],
    /** Folders open in the sidebar, in order. */
    folders: [] as string[],
    /** Favourite documents, pinned below the folders. */
    favorites: [] as string[],
    /** Sidebar sections the user collapsed (folder paths or "favorites"). */
    collapsed: [] as string[],
    /** Relative heights of the folder sections (dragging the bars between them). */
    sectionGrow: {} as Record<string, number> }),
);

export const app = $state({
  path: null as string | null,
  /** A document (saved or untitled) is open; false shows the welcome screen. */
  docOpen: false,
  /** The active document uses Windows line endings on disk. */
  crlf: false,
  tabs: [] as Tab[],
  activeTab: -1,
  content: '',
  saved: '',
  /** Bumped whenever content is replaced from outside the editors (open, reload, checkbox). */
  extVersion: 0,
  mode: 'preview' as Mode,
  root: null as string | null,
  sidebar: true,
  sidebarTab: 'files' as 'files' | 'outline' | 'search',
  /** Bumped to focus the search box. */
  searchFocus: 0,
  quickOpen: false,
  /** Number of sheets in page view (0 when off). */
  pageCount: 0,
  /** Duration of the last pagination (diagnostics and performance tests). */
  paginateMs: 0,
  zen: false,
  /** Zen entered through "Focus writing": forces line focus and typewriter scrolling. */
  focusWriting: false,
  selection: '',
  /** Caret position in the source editor (1-based), for the status bar. */
  cursor: { line: 1, col: 1 },
  /** Source line at the top of the preview or under the caret, for the outline highlight. */
  viewLine: 1,
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
  /** Source-editor commands (search, multi-cursor, line operations); absent in the visual editor. */
  run?(cmd: import('./editor/commands').SourceCommand): void;
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

export function pushRecentFolder(path: string) {
  session.recentFolders = [path, ...(session.recentFolders ?? []).filter((p) => p !== path)].slice(0, 10);
}

/** Forgets recently opened files and folders (File > Open Recent > Clear, Welcome screen). */
export function clearHistory() {
  session.recent = [];
  session.recentFolders = [];
}

export function pushRecent(path: string) {
  session.recent = [path, ...session.recent.filter((p) => p !== path)].slice(0, 12);
}

/** Focus writing session (full screen, current line lit, caret centered) regardless of settings. */
export const focusWriting = () => app.zen && app.focusWriting;
export const focusActive = () => focusWriting() || (settings.focusMode !== 'off' && (!settings.focusOnlyZen || app.zen));
/** The focus highlight in effect: the current line in a focus writing session, else the user's choice. */
export const focusModeNow = (): FocusMode =>
  focusWriting() ? 'line' : !focusActive() ? 'off' : settings.focusMode;
export const typewriterActive = () => focusWriting() || (settings.typewriterScroll && (!settings.typewriterOnlyZen || app.zen));
export const soundActive = () => settings.typingSound !== 'off' && (!settings.soundOnlyZen || app.zen);
