// Themes are data, not CSS, so the same values can style the app, Mermaid and exported files.

export type ThemeKind = 'normal' | 'typewriter' | 'crt' | 'tractor' | 'calm' | 'dos' | 'terminal' | 'aqua' | 'screenplay' | 'book'
  | 'notebook' | 'eink' | 'accessible' | 'chalk' | 'gameboy' | 'teletype' | 'parchment';

/** Optional visual effects; Settings only offers the ones the active theme supports. */
export type ThemeEffect = 'scanlines' | 'glow' | 'flicker' | 'curvature' | 'paper' | 'ink';

/** Typing sound a theme suggests (played when "Use the theme's sounds" is on). */
export type ThemeSound = 'typewriter' | 'mechanical' | 'soft' | 'chalk' | 'quill';

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  kind: ThemeKind;
  fonts: { ui: string; doc: string; heading: string; code: string };
  vars: Record<string, string>;
  /** The same theme in the other appearance (light ↔ dark), used by the appearance toggle. */
  pair?: string;
  effects?: ThemeEffect[];
  sound?: ThemeSound;
  /** What the theme is for: writing, a retro mood, or paper meant for reading and output. */
  group: ThemeGroup;
  /** Decorative face (dot matrix, VT323, VGA…): used for headings, and for body text only if the
   *  user asks for it — long text stays in the legible `fonts.doc`. */
  display?: string;
  caret?: Caret;
}

/** How the text cursor looks while writing on this sheet. */
export interface Caret {
  shape: 'bar' | 'block' | 'underline';
  /** steps = classic on/off, smooth = fades in and out (a glowing prompt), none = always on. */
  blink: 'steps' | 'smooth' | 'none';
  color?: string;
  /** Bar thickness. */
  width?: string;
  glow?: boolean;
  /** Blink period in ms. */
  rate?: number;
}

export const DEFAULT_CARET: Caret = { shape: 'bar', blink: 'steps', width: '2px', rate: 1200 };

export type ThemeGroup = 'writing' | 'retro' | 'paper';
export const THEME_GROUPS: ThemeGroup[] = ['writing', 'retro', 'paper'];

export const FONTS: Record<string, { label: string; stack: string }> = {
  system: { label: 'System Sans', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Cantarell, Ubuntu, "Helvetica Neue", sans-serif' },
  inter: { label: 'Inter', stack: '"Inter Variable", "Inter", system-ui, sans-serif' },
  literata: { label: 'Literata', stack: '"Literata Variable", Literata, Georgia, serif' },
  plexSerif: { label: 'IBM Plex Serif', stack: '"IBM Plex Serif", Georgia, serif' },
  serif: { label: 'System Serif', stack: '"New York", "Iowan Old Style", Charter, Cambria, Georgia, serif' },
  plexMono: { label: 'IBM Plex Mono', stack: '"IBM Plex Mono", ui-monospace, monospace' },
  courier: { label: 'Courier Prime', stack: '"Courier Prime", "Courier New", Courier, monospace' },
  elite: { label: 'Special Elite', stack: '"Special Elite", "Courier Prime", "American Typewriter", monospace' },
  vt323: { label: 'VT323', stack: 'VT323, "IBM Plex Mono", monospace' },
  doto: { label: 'Doto (dot matrix)', stack: 'Doto, "Courier Prime", monospace' },
  iaQuattro: { label: 'iA Writer Quattro', stack: '"iA Writer Quattro S", "IBM Plex Sans", system-ui, sans-serif' },
  iaMono: { label: 'iA Writer Mono', stack: '"iA Writer Mono S", "IBM Plex Mono", ui-monospace, monospace' },
  atkinson: { label: 'Atkinson Hyperlegible', stack: '"Atkinson Hyperlegible Next", system-ui, sans-serif' },
  lexend: { label: 'Lexend', stack: 'Lexend, system-ui, sans-serif' },
  sourceSerif: { label: 'Source Serif 4', stack: '"Source Serif 4", Georgia, serif' },
  jetbrains: { label: 'JetBrains Mono', stack: '"JetBrains Mono", ui-monospace, monospace' },
  vga: { label: 'IBM VGA (MS-DOS)', stack: '"Px437 IBM VGA", VT323, ui-monospace, monospace' },
  lucida: { label: 'Lucida Grande', stack: '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Helvetica, sans-serif' },
  ebGaramond: { label: 'EB Garamond', stack: '"EB Garamond", Garamond, Georgia, serif' },
  imFell: { label: 'IM Fell English', stack: '"IM Fell English", "EB Garamond", Georgia, serif' },
  caveat: { label: 'Caveat (handwriting)', stack: 'Caveat, "Patrick Hand", cursive' },
  patrickHand: { label: 'Patrick Hand', stack: '"Patrick Hand", "Atkinson Hyperlegible Next", sans-serif' },
  fredericka: { label: 'Fredericka the Great (chalk)', stack: '"Fredericka the Great", "Patrick Hand", cursive' },
  pressStart: { label: 'Press Start 2P (pixel)', stack: '"Press Start 2P", "Pixelify Sans", monospace' },
  pixelify: { label: 'Pixelify Sans', stack: '"Pixelify Sans", "JetBrains Mono", monospace' },
  mono: { label: 'System Mono', stack: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, "DejaVu Sans Mono", monospace' },
};

const F = (id: string) => FONTS[id].stack;

function light(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    '--bg': '#ffffff',
    '--bg-elev': '#f5f5f7',
    '--bg-hover': 'rgba(0,0,0,.055)',
    '--bg-active': 'rgba(0,0,0,.09)',
    '--fg': '#1d1d1f',
    '--fg-muted': '#6e6e73',
    '--fg-dim': 'rgba(29,29,31,.28)',
    '--border': '#e3e3e8',
    '--accent': '#0a84ff',
    '--accent-fg': '#ffffff',
    '--link': '#0866d6',
    '--code-bg': '#f3f3f6',
    '--code-fg': '#c41a5f',
    '--sel': 'rgba(10,132,255,.22)',
    '--quote': '#d2d2d7',
    '--mark': '#fff3a3',
    '--syn-keyword': '#a626a4',
    '--syn-string': '#50a14f',
    '--syn-number': '#986801',
    '--syn-comment': '#a0a1a7',
    '--syn-func': '#4078f2',
    '--syn-type': '#c18401',
    '--shadow': '0 10px 30px rgba(0,0,0,.14), 0 1px 3px rgba(0,0,0,.08)',
    ...overrides,
  };
}

function dark(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    '--bg': '#1c1c1e',
    '--bg-elev': '#232326',
    '--bg-hover': 'rgba(255,255,255,.07)',
    '--bg-active': 'rgba(255,255,255,.12)',
    '--fg': '#e9e9ee',
    '--fg-muted': '#9a9aa2',
    '--fg-dim': 'rgba(233,233,238,.25)',
    '--border': '#38383c',
    '--accent': '#0a84ff',
    '--accent-fg': '#ffffff',
    '--link': '#5aa9ff',
    '--code-bg': '#2a2a2e',
    '--code-fg': '#ff7ab2',
    '--sel': 'rgba(10,132,255,.35)',
    '--quote': '#4a4a50',
    '--mark': '#6b5a12',
    '--syn-keyword': '#ff7ab2',
    '--syn-string': '#ff8170',
    '--syn-number': '#d9c97c',
    '--syn-comment': '#7f8c98',
    '--syn-func': '#67b7a4',
    '--syn-type': '#dabaff',
    '--shadow': '0 12px 36px rgba(0,0,0,.5), 0 1px 3px rgba(0,0,0,.4)',
    ...overrides,
  };
}

export const THEMES: Theme[] = [
  {
    id: 'modern', group: 'writing', name: 'Modern', dark: false, kind: 'normal', pair: 'modern-dark',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: light(),
  },
  {
    id: 'modern-dark', group: 'writing', name: 'Modern Dark', dark: true, kind: 'normal', pair: 'modern',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: dark(),
  },
  {
    id: 'github', group: 'writing', name: 'GitHub', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('system'), heading: F('system'), code: F('mono') },
    vars: light({ '--bg-elev': '#f6f8fa', '--fg': '#1f2328', '--fg-muted': '#59636e', '--border': '#d1d9e0', '--accent': '#0969da', '--link': '#0969da', '--code-bg': '#f6f8fa', '--code-fg': '#1f2328', '--quote': '#d1d9e0' }),
  },
  {
    id: 'paper', group: 'paper', name: 'Paper', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('literata'), heading: F('literata'), code: F('plexMono') },
    vars: light({ '--bg': '#f7f2e8', '--bg-elev': '#efe8da', '--fg': '#3a3128', '--fg-muted': '#6a5e4f', '--fg-dim': 'rgba(58,49,40,.28)', '--border': '#e0d6c3', '--accent': '#b5651d', '--link': '#9a4f12', '--code-bg': '#eee5d3', '--code-fg': '#8b3a1a', '--quote': '#d8c9ad', '--sel': 'rgba(181,101,29,.2)' }),
  },
  {
    id: 'typewriter', group: 'retro', caret: { shape: 'block', blink: 'none', color: 'color-mix(in srgb, var(--accent) 30%, transparent)' }, name: 'Typewriter', dark: false, kind: 'typewriter', effects: ['paper', 'ink'], sound: 'typewriter',
    fonts: { ui: F('courier'), doc: F('courier'), heading: F('elite'), code: F('courier') },
    vars: light({ '--bg': '#f1ead6', '--bg-elev': '#e8dfc6', '--bg-hover': 'rgba(60,40,10,.07)', '--bg-active': 'rgba(60,40,10,.12)', '--fg': '#26231f', '--fg-muted': '#6d6556', '--fg-dim': 'rgba(38,35,31,.25)', '--border': '#d6caa9', '--accent': '#a5281b', '--link': '#7b1f14', '--code-bg': '#e6dcc0', '--code-fg': '#26231f', '--quote': '#bfae86', '--sel': 'rgba(165,40,27,.18)', '--mark': '#f0d56a', '--syn-keyword': '#a5281b', '--syn-string': '#3d5a2a', '--syn-number': '#6d4c1a', '--syn-comment': '#8c826d', '--syn-func': '#26231f', '--syn-type': '#6d4c1a' }),
  },
  {
    id: 'tractor', group: 'paper', display: F('doto'), caret: { shape: 'block', blink: 'steps', color: 'color-mix(in srgb, var(--accent) 45%, transparent)' }, name: 'Continuous Paper', dark: false, kind: 'tractor', sound: 'mechanical',
    fonts: { ui: F('system'), doc: F('plexMono'), heading: F('doto'), code: F('plexMono') },
    vars: light({ '--bg': '#e4e6df', '--bg-elev': '#dcdfd6', '--bg-hover': 'rgba(40,60,40,.07)', '--bg-active': 'rgba(40,60,40,.12)', '--paper': '#fbfcf7', '--perf': '#bfc6b4', '--fg': '#2a2e35', '--fg-muted': '#6a7068', '--fg-dim': 'rgba(42,46,53,.25)', '--border': '#cdd2c5', '--accent': '#2f7d4f', '--link': '#2b5c99', '--code-bg': 'rgba(60,80,60,.07)', '--code-fg': '#2a2e35', '--quote': '#b9c4b0', '--sel': 'rgba(47,125,79,.2)', '--mark': '#f2e58f', '--syn-keyword': '#2f7d4f', '--syn-string': '#8a4b2a', '--syn-number': '#2b5c99', '--syn-comment': '#8b9186', '--syn-func': '#2a2e35', '--syn-type': '#5b4a8a' }),
  },
  {
    id: 'calm', group: 'writing', caret: { shape: 'bar', blink: 'smooth', width: '3px', color: '#11a5f2', rate: 1100 }, name: 'Calm', dark: false, kind: 'calm', pair: 'calm-dark',
    fonts: { ui: F('system'), doc: F('iaQuattro'), heading: F('iaQuattro'), code: F('iaMono') },
    vars: light({ '--bg': '#f9f9f8', '--bg-elev': '#f3f3f1', '--bg-hover': 'rgba(0,0,0,.045)', '--bg-active': 'rgba(0,0,0,.08)', '--fg': '#1b1b1b', '--fg-muted': '#6a6a66', '--fg-dim': 'rgba(27,27,27,.22)', '--border': '#e6e6e2', '--accent': '#11a5f2', '--link': '#0a6aa8', '--code-bg': 'rgba(0,0,0,.04)', '--code-fg': '#1b1b1b', '--quote': '#d9d9d4', '--sel': 'rgba(17,165,242,.18)', '--mark': '#fff2a8' }),
  },
  {
    id: 'calm-dark', group: 'writing', caret: { shape: 'bar', blink: 'smooth', width: '3px', color: '#11a5f2', rate: 1100 }, name: 'Calm Night', dark: true, kind: 'calm', pair: 'calm',
    fonts: { ui: F('system'), doc: F('iaQuattro'), heading: F('iaQuattro'), code: F('iaMono') },
    vars: dark({ '--bg': '#1a1b1d', '--bg-elev': '#1f2022', '--fg': '#cfcfcc', '--fg-muted': '#9a9b98', '--fg-dim': 'rgba(207,207,204,.2)', '--border': '#2b2c2e', '--accent': '#11a5f2', '--link': '#4cb9f5', '--code-bg': 'rgba(255,255,255,.05)', '--code-fg': '#cfcfcc', '--quote': '#3a3b3d', '--sel': 'rgba(17,165,242,.28)' }),
  },
  {
    id: 'screenplay', group: 'paper', caret: { shape: 'block', blink: 'none', color: 'color-mix(in srgb, var(--accent) 30%, transparent)' }, name: 'Screenplay', dark: false, kind: 'screenplay', effects: ['paper', 'ink'], sound: 'typewriter',
    fonts: { ui: F('courier'), doc: F('courier'), heading: F('courier'), code: F('courier') },
    vars: light({ '--bg': '#f4f1e8', '--bg-elev': '#ebe6d8', '--fg': '#1e1e1e', '--fg-muted': '#6b665b', '--fg-dim': 'rgba(30,30,30,.22)', '--border': '#d8d1bd', '--accent': '#b3261e', '--link': '#1e1e1e', '--code-bg': 'transparent', '--code-fg': '#1e1e1e', '--quote': '#c9bfa5', '--sel': 'rgba(179,38,30,.16)', '--paper': '#fffdf6' }),
  },
  {
    id: 'msdos', group: 'retro', display: F('vga'), caret: { shape: 'underline', blink: 'steps', color: '#ffffff', rate: 530 }, name: 'MS-DOS', dark: true, kind: 'dos', effects: ['scanlines'], sound: 'mechanical',
    fonts: { ui: F('system'), doc: F('plexMono'), heading: F('vga'), code: F('plexMono') },
    vars: dark({ '--bg': '#0000aa', '--bg-elev': '#0000aa', '--bg-hover': '#5555ff', '--bg-active': '#00aaaa', '--fg': '#d0d0d0', '--fg-muted': '#55ffff', '--fg-dim': 'rgba(170,170,170,.35)', '--border': '#55ffff', '--accent': '#ffff55', '--accent-fg': '#0000aa', '--link': '#55ffff', '--code-bg': '#000000', '--code-fg': '#55ff55', '--quote': '#aaaaaa', '--sel': '#00aaaa', '--mark': '#aa5500', '--syn-keyword': '#ffff55', '--syn-string': '#55ff55', '--syn-number': '#ff55ff', '--syn-comment': '#aaaaaa', '--syn-func': '#55ffff', '--syn-type': '#ffffff', '--shadow': '6px 6px 0 #000000' }),
  },
  {
    id: 'terminal', group: 'retro', caret: { shape: 'block', blink: 'smooth', glow: true, color: 'var(--accent)', rate: 1060 }, name: 'Terminal', dark: true, kind: 'terminal', sound: 'mechanical',
    fonts: { ui: F('jetbrains'), doc: F('jetbrains'), heading: F('jetbrains'), code: F('jetbrains') },
    vars: dark({ '--bg': '#0c0c0c', '--bg-elev': '#121212', '--bg-hover': 'rgba(255,255,255,.06)', '--fg': '#d0d0d0', '--fg-muted': '#7a7a7a', '--fg-dim': 'rgba(208,208,208,.22)', '--border': '#262626', '--accent': '#23d18b', '--accent-fg': '#0c0c0c', '--link': '#3b8eea', '--code-bg': '#161616', '--code-fg': '#e5c07b', '--quote': '#3a3a3a', '--sel': 'rgba(35,209,139,.25)', '--syn-keyword': '#c678dd', '--syn-string': '#98c379', '--syn-number': '#d19a66', '--syn-comment': '#5c6370', '--syn-func': '#61afef', '--syn-type': '#e5c07b' }),
  },
  {
    id: 'aqua', group: 'retro', caret: { shape: 'bar', blink: 'steps', width: '2px', color: '#000000', rate: 1000 }, name: 'Mac OS X Aqua', dark: false, kind: 'aqua', sound: 'soft',
    fonts: { ui: F('lucida'), doc: F('lucida'), heading: F('lucida'), code: F('mono') },
    vars: light({ '--bg': '#ffffff', '--bg-elev': '#e8e8e8', '--bg-hover': 'rgba(56,117,215,.10)', '--bg-active': 'rgba(56,117,215,.18)', '--fg': '#000000', '--fg-muted': '#5a5a5a', '--border': '#a5a5a5', '--accent': '#3875d7', '--link': '#1d5bd1', '--code-bg': '#f2f2f2', '--code-fg': '#000000', '--quote': '#b5b5b5', '--sel': '#b5d5ff', '--shadow': '0 8px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.25)' }),
  },
  {
    id: 'chalkboard', group: 'retro', name: 'Chalkboard', dark: true, kind: 'chalk', sound: 'chalk',
    caret: { shape: 'bar', blink: 'smooth', width: '3px', color: '#f4f1e6', rate: 1200 },
    fonts: { ui: F('system'), doc: F('patrickHand'), heading: F('fredericka'), code: F('patrickHand') },
    vars: dark({ '--bg': '#233a2e', '--bg-elev': '#2a4436', '--fg': '#f4f1e6', '--fg-muted': '#cfd8c8', '--fg-dim': 'rgba(244,241,230,.25)', '--border': '#4c6b58', '--accent': '#ffe28a', '--accent-fg': '#233a2e', '--link': '#ffe28a', '--code-bg': 'rgba(255,255,255,.07)', '--code-fg': '#bfe3ff', '--quote': '#6c8c78', '--sel': 'rgba(255,226,138,.22)', '--mark': '#7a6a2a', '--syn-keyword': '#ffe28a', '--syn-string': '#bfe3ff', '--syn-number': '#ffb3c1', '--syn-comment': '#a9bfae', '--syn-func': '#f4f1e6', '--syn-type': '#ffd0a6' }),
  },
  {
    id: 'gameboy', group: 'retro', name: 'Game Boy', dark: false, kind: 'gameboy', sound: 'soft', display: F('pressStart'),
    caret: { shape: 'block', blink: 'steps', color: '#0f380f', rate: 800 },
    fonts: { ui: F('system'), doc: F('jetbrains'), heading: F('pressStart'), code: F('jetbrains') },
    vars: light({ '--bg': '#b2cc55', '--bg-elev': '#a2bc45', '--bg-hover': 'rgba(15,56,15,.1)', '--fg': '#0f380f', '--fg-muted': '#1d4a1d', '--fg-dim': 'rgba(15,56,15,.35)', '--border': '#306230', '--accent': '#0f380f', '--accent-fg': '#9bbc0f', '--link': '#0f380f', '--code-bg': '#a2bc45', '--code-fg': '#0f380f', '--quote': '#306230', '--sel': 'rgba(15,56,15,.22)', '--mark': '#c4d96a', '--syn-keyword': '#0f380f', '--syn-string': '#0f380f', '--syn-number': '#0f380f', '--syn-comment': '#1d4a1d', '--syn-func': '#0f380f', '--syn-type': '#0f380f', '--shadow': 'none' }),
  },
  {
    id: 'teletype', group: 'retro', name: 'Teletype', dark: false, kind: 'teletype', sound: 'mechanical', effects: ['ink'],
    caret: { shape: 'block', blink: 'none', color: 'color-mix(in srgb, var(--fg) 35%, transparent)' },
    fonts: { ui: F('system'), doc: F('courier'), heading: F('courier'), code: F('courier') },
    vars: light({ '--bg': '#e9e2c6', '--bg-elev': '#e0d8b8', '--paper': '#f6efcf', '--fg': '#23201a', '--fg-muted': '#544c3c', '--border': '#cfc39a', '--accent': '#23201a', '--link': '#23201a', '--code-bg': 'transparent', '--code-fg': '#23201a', '--quote': '#bfb187', '--sel': 'rgba(35,32,26,.15)', '--perf': '#cbbd8e' }),
  },
  {
    id: 'parchment', group: 'retro', name: 'Parchment', dark: false, kind: 'parchment', sound: 'quill', effects: ['paper', 'ink'],
    caret: { shape: 'bar', blink: 'smooth', width: '2px', color: '#5a2d0c', rate: 1400 },
    fonts: { ui: F('system'), doc: F('ebGaramond'), heading: F('imFell'), code: F('plexMono') },
    vars: light({ '--bg': '#efe0bd', '--bg-elev': '#e6d4ac', '--fg': '#2b1d0e', '--fg-muted': '#5a4428', '--border': '#cdb68a', '--accent': '#7a2e0c', '--link': '#6b280b', '--code-bg': 'rgba(90,45,12,.08)', '--code-fg': '#4a250a', '--quote': '#b89a66', '--sel': 'rgba(122,46,12,.16)', '--mark': '#e8c873' }),
  },
  {
    id: 'crt-green', group: 'retro', display: F('vt323'), caret: { shape: 'block', blink: 'smooth', glow: true, color: 'var(--fg)', rate: 1000 }, name: 'CRT Phosphor', dark: true, kind: 'crt', effects: ['scanlines', 'glow', 'flicker', 'curvature'], sound: 'mechanical',
    fonts: { ui: F('system'), doc: F('plexMono'), heading: F('vt323'), code: F('plexMono') },
    vars: dark({ '--bg': '#040b05', '--bg-elev': '#071209', '--bg-hover': 'rgba(51,255,102,.08)', '--bg-active': 'rgba(51,255,102,.16)', '--fg': '#3dff73', '--fg-muted': '#22a849', '--fg-dim': 'rgba(61,255,115,.25)', '--border': '#0f3a19', '--accent': '#3dff73', '--accent-fg': '#021004', '--link': '#a6ffbf', '--code-bg': '#08200d', '--code-fg': '#a6ffbf', '--quote': '#1b6b30', '--sel': 'rgba(61,255,115,.25)', '--mark': '#1d6b33', '--glow': 'rgba(61,255,115,.55)', '--syn-keyword': '#a6ffbf', '--syn-string': '#7dffa0', '--syn-number': '#d4ffe0', '--syn-comment': '#1f8a3e', '--syn-func': '#5cff8a', '--syn-type': '#c3ffd4' }),
  },
  {
    id: 'crt-amber', group: 'retro', display: F('vt323'), caret: { shape: 'block', blink: 'smooth', glow: true, color: 'var(--fg)', rate: 1000 }, name: 'CRT Amber', dark: true, kind: 'crt', effects: ['scanlines', 'glow', 'flicker', 'curvature'], sound: 'mechanical',
    fonts: { ui: F('system'), doc: F('plexMono'), heading: F('vt323'), code: F('plexMono') },
    vars: dark({ '--bg': '#0d0800', '--bg-elev': '#140c01', '--bg-hover': 'rgba(255,176,0,.08)', '--bg-active': 'rgba(255,176,0,.16)', '--fg': '#ffb000', '--fg-muted': '#b07a00', '--fg-dim': 'rgba(255,176,0,.25)', '--border': '#3d2a00', '--accent': '#ffb000', '--accent-fg': '#140c00', '--link': '#ffd27a', '--code-bg': '#221600', '--code-fg': '#ffd27a', '--quote': '#7a5400', '--sel': 'rgba(255,176,0,.25)', '--mark': '#6b4a00', '--glow': 'rgba(255,176,0,.5)', '--crt-hue': '0deg', '--syn-keyword': '#ffd27a', '--syn-string': '#ffc54d', '--syn-number': '#ffe6b0', '--syn-comment': '#8a6000', '--syn-func': '#ffbf33', '--syn-type': '#ffdd99' }),
  },
  {
    id: 'notebook', group: 'writing', name: 'Notebook', dark: false, kind: 'notebook',
    caret: { shape: 'bar', blink: 'steps', width: '2px', color: '#1f4fa8' },
    fonts: { ui: F('system'), doc: F('atkinson'), heading: F('caveat'), code: F('plexMono') },
    vars: light({ '--bg': '#fbfaf4', '--bg-elev': '#f2f0e6', '--fg': '#1d2433', '--fg-muted': '#4f5a6e', '--border': '#dcd8c8', '--accent': '#1f4fa8', '--link': '#1f4fa8', '--code-bg': 'rgba(31,79,168,.06)', '--code-fg': '#7a1f4a', '--quote': '#c8d3e8', '--sel': 'rgba(31,79,168,.16)', '--rule': 'rgba(90,130,200,.22)', '--margin-line': 'rgba(214,72,72,.45)' }),
  },
  {
    id: 'manuscript', group: 'writing', name: 'Manuscript', dark: false, kind: 'book', pair: 'sepia-night',
    caret: { shape: 'bar', blink: 'smooth', width: '2px', color: '#8b1e1e', rate: 1300 },
    fonts: { ui: F('system'), doc: F('literata'), heading: F('literata'), code: F('plexMono') },
    vars: light({ '--bg': '#fbf8f1', '--bg-elev': '#f3eee2', '--fg': '#1e1b16', '--fg-muted': '#5c554a', '--border': '#e2dac8', '--accent': '#8b1e1e', '--link': '#7a1c1c', '--code-bg': '#f1ebdd', '--code-fg': '#5a2b10', '--quote': '#d6cbb2', '--sel': 'rgba(139,30,30,.14)' }),
  },
  {
    id: 'sepia-night', group: 'writing', name: 'Sepia Night', dark: true, kind: 'book', pair: 'manuscript',
    caret: { shape: 'bar', blink: 'smooth', width: '2px', color: '#e0a458', rate: 1300 },
    fonts: { ui: F('system'), doc: F('literata'), heading: F('literata'), code: F('plexMono') },
    vars: dark({ '--bg': '#1e1912', '--bg-elev': '#241e16', '--fg': '#e9dbc2', '--fg-muted': '#b6a68a', '--fg-dim': 'rgba(233,219,194,.22)', '--border': '#3a3125', '--accent': '#e0a458', '--accent-fg': '#1e1912', '--link': '#e8b878', '--code-bg': '#2a2319', '--code-fg': '#f0c992', '--quote': '#5a4b36', '--sel': 'rgba(224,164,88,.25)', '--mark': '#5c4519', '--syn-keyword': '#e0a458', '--syn-string': '#c8b27c', '--syn-number': '#e8b878', '--syn-comment': '#9a8a70', '--syn-func': '#e9dbc2', '--syn-type': '#d9a27a' }),
  },
  {
    id: 'eink', group: 'writing', name: 'E-ink', dark: false, kind: 'eink',
    caret: { shape: 'bar', blink: 'none', width: '2px', color: '#000000' },
    fonts: { ui: F('system'), doc: F('literata'), heading: F('literata'), code: F('plexMono') },
    vars: light({ '--bg': '#f1f1ec', '--bg-elev': '#e8e8e2', '--fg': '#111111', '--fg-muted': '#4a4a4a', '--fg-dim': 'rgba(17,17,17,.3)', '--border': '#c9c9c2', '--accent': '#111111', '--accent-fg': '#f1f1ec', '--link': '#111111', '--code-bg': '#e4e4de', '--code-fg': '#111111', '--quote': '#9a9a94', '--sel': 'rgba(0,0,0,.14)', '--mark': '#d6d6cf', '--syn-keyword': '#111111', '--syn-string': '#333333', '--syn-number': '#333333', '--syn-comment': '#5c5c5c', '--syn-func': '#111111', '--syn-type': '#333333', '--shadow': 'none' }),
  },
  {
    id: 'accessible', group: 'writing', name: 'Accessible', dark: false, kind: 'accessible',
    caret: { shape: 'bar', blink: 'none', width: '3px', color: '#0b4fd6' },
    fonts: { ui: F('system'), doc: F('atkinson'), heading: F('atkinson'), code: F('jetbrains') },
    vars: light({ '--bg': '#fdfbf3', '--bg-elev': '#f5f2e6', '--fg': '#141414', '--fg-muted': '#3f3f3f', '--border': '#d8d3c2', '--accent': '#0b4fd6', '--link': '#0b4fd6', '--code-bg': '#efebdd', '--code-fg': '#141414', '--quote': '#b9b3a0', '--sel': 'rgba(11,79,214,.18)', '--mark': '#ffe27a' }),
  },
  {
    id: 'nord', group: 'writing', name: 'Nord', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('plexMono') },
    vars: dark({ '--bg': '#2e3440', '--bg-elev': '#3b4252', '--fg': '#e5e9f0', '--fg-muted': '#a3abba', '--fg-dim': 'rgba(229,233,240,.25)', '--border': '#434c5e', '--accent': '#88c0d0', '--accent-fg': '#2e3440', '--link': '#88c0d0', '--code-bg': '#3b4252', '--code-fg': '#ebcb8b', '--quote': '#4c566a', '--sel': 'rgba(136,192,208,.3)', '--syn-keyword': '#81a1c1', '--syn-string': '#a3be8c', '--syn-number': '#b48ead', '--syn-comment': '#616e88', '--syn-func': '#88c0d0', '--syn-type': '#8fbcbb' }),
  },
  {
    id: 'solarized', group: 'writing', name: 'Solarized Light', dark: false, kind: 'normal', pair: 'solarized-dark',
    fonts: { ui: F('system'), doc: F('plexSerif'), heading: F('plexSerif'), code: F('plexMono') },
    vars: light({ '--bg': '#fdf6e3', '--bg-elev': '#eee8d5', '--fg': '#3c4a50', '--fg-muted': '#5f7176', '--fg-dim': 'rgba(60,74,80,.28)', '--border': '#e4dcc4', '--accent': '#268bd2', '--link': '#1a6aa6', '--code-bg': '#eee8d5', '--code-fg': '#a8296a', '--quote': '#d9cfb0', '--syn-keyword': '#859900', '--syn-string': '#2aa198', '--syn-number': '#d33682', '--syn-comment': '#93a1a1', '--syn-func': '#268bd2', '--syn-type': '#b58900' }),
  },
  {
    id: 'gruvbox', group: 'writing', name: 'Gruvbox', dark: true, kind: 'normal', pair: 'gruvbox-light',
    fonts: { ui: F('system'), doc: F('plexSerif'), heading: F('plexSerif'), code: F('jetbrains') },
    vars: dark({ '--bg': '#282828', '--bg-elev': '#32302f', '--fg': '#ebdbb2', '--fg-muted': '#bdae93', '--fg-dim': 'rgba(235,219,178,.22)', '--border': '#504945', '--accent': '#fabd2f', '--accent-fg': '#282828', '--link': '#83a598', '--code-bg': '#3c3836', '--code-fg': '#fe8019', '--quote': '#665c54', '--sel': 'rgba(250,189,47,.22)', '--mark': '#6b5b1f', '--syn-keyword': '#fb4934', '--syn-string': '#b8bb26', '--syn-number': '#d3869b', '--syn-comment': '#a89984', '--syn-func': '#8ec07c', '--syn-type': '#fabd2f' }),
  },
  {
    id: 'gruvbox-light', group: 'writing', name: 'Gruvbox Light', dark: false, kind: 'normal', pair: 'gruvbox',
    fonts: { ui: F('system'), doc: F('plexSerif'), heading: F('plexSerif'), code: F('jetbrains') },
    vars: light({ '--bg': '#fbf1c7', '--bg-elev': '#f2e5bc', '--fg': '#3c3836', '--fg-muted': '#5f5048', '--border': '#d5c4a1', '--accent': '#b57614', '--link': '#076678', '--code-bg': '#ebdbb2', '--code-fg': '#8f3f71', '--quote': '#bdae93', '--sel': 'rgba(181,118,20,.18)', '--syn-keyword': '#9d0006', '--syn-string': '#79740e', '--syn-number': '#8f3f71', '--syn-comment': '#7c6f64', '--syn-func': '#427b58', '--syn-type': '#b57614' }),
  },
  {
    id: 'catppuccin', group: 'writing', name: 'Catppuccin Mocha', dark: true, kind: 'normal', pair: 'catppuccin-latte',
    caret: { shape: 'bar', blink: 'smooth', width: '2px', color: '#f5c2e7', rate: 1100 },
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('jetbrains') },
    vars: dark({ '--bg': '#1e1e2e', '--bg-elev': '#181825', '--fg': '#cdd6f4', '--fg-muted': '#a6adc8', '--fg-dim': 'rgba(205,214,244,.22)', '--border': '#313244', '--accent': '#cba6f7', '--accent-fg': '#1e1e2e', '--link': '#89b4fa', '--code-bg': '#313244', '--code-fg': '#f5c2e7', '--quote': '#45475a', '--sel': 'rgba(203,166,247,.25)', '--mark': '#5b4a2a', '--syn-keyword': '#cba6f7', '--syn-string': '#a6e3a1', '--syn-number': '#fab387', '--syn-comment': '#9399b2', '--syn-func': '#89b4fa', '--syn-type': '#f9e2af' }),
  },
  {
    id: 'catppuccin-latte', group: 'writing', name: 'Catppuccin Latte', dark: false, kind: 'normal', pair: 'catppuccin',
    caret: { shape: 'bar', blink: 'smooth', width: '2px', color: '#8839ef', rate: 1100 },
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('jetbrains') },
    vars: light({ '--bg': '#eff1f5', '--bg-elev': '#e6e9ef', '--fg': '#4c4f69', '--fg-muted': '#5c5f77', '--border': '#ccd0da', '--accent': '#8839ef', '--link': '#1a56d6', '--code-bg': '#e6e9ef', '--code-fg': '#b4237f', '--quote': '#bcc0cc', '--sel': 'rgba(136,57,239,.16)', '--syn-keyword': '#8839ef', '--syn-string': '#40a02b', '--syn-number': '#fe640b', '--syn-comment': '#6c6f85', '--syn-func': '#1e66f5', '--syn-type': '#df8e1d' }),
  },
  {
    id: 'solarized-dark', group: 'writing', name: 'Solarized Dark', dark: true, kind: 'normal', pair: 'solarized',
    fonts: { ui: F('system'), doc: F('plexSerif'), heading: F('plexSerif'), code: F('plexMono') },
    vars: dark({ '--bg': '#002b36', '--bg-elev': '#073642', '--fg': '#d2dcdc', '--fg-muted': '#93a1a1', '--fg-dim': 'rgba(210,220,220,.22)', '--border': '#0d4250', '--accent': '#268bd2', '--link': '#5fafe8', '--code-bg': '#073642', '--code-fg': '#f472b0', '--quote': '#2a5562', '--sel': 'rgba(38,139,210,.3)', '--mark': '#5c4a00', '--syn-keyword': '#859900', '--syn-string': '#2aa198', '--syn-number': '#d33682', '--syn-comment': '#839496', '--syn-func': '#268bd2', '--syn-type': '#b58900' }),
  },
  {
    id: 'dracula', group: 'writing', name: 'Dracula', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: dark({ '--bg': '#282a36', '--bg-elev': '#21222c', '--fg': '#f8f8f2', '--fg-muted': '#a4a8c2', '--border': '#3a3d4d', '--accent': '#bd93f9', '--accent-fg': '#282a36', '--link': '#8be9fd', '--code-bg': '#343746', '--code-fg': '#ff79c6', '--quote': '#6272a4', '--sel': 'rgba(189,147,249,.3)', '--syn-keyword': '#ff79c6', '--syn-string': '#f1fa8c', '--syn-number': '#bd93f9', '--syn-comment': '#6272a4', '--syn-func': '#50fa7b', '--syn-type': '#8be9fd' }),
  },
  {
    id: 'contrast', group: 'writing', name: 'High Contrast', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('system'), heading: F('system'), code: F('mono') },
    vars: dark({ '--bg': '#000000', '--bg-elev': '#0d0d0d', '--fg': '#ffffff', '--fg-muted': '#d0d0d0', '--fg-dim': 'rgba(255,255,255,.35)', '--border': '#ffffff', '--accent': '#ffd60a', '--accent-fg': '#000000', '--link': '#7cc4ff', '--code-bg': '#1a1a1a', '--code-fg': '#ffd60a', '--quote': '#ffffff' }),
  },
];

/** The setting that switches each effect on or off. */
export const EFFECT_SETTING = {
  scanlines: 'crtScanlines', glow: 'crtGlow', flicker: 'crtFlicker', curvature: 'crtCurvature', paper: 'paperTexture', ink: 'inkVariation',
} as const satisfies Record<ThemeEffect, string>;

/** Effects a theme supports that the user has left on. */
export function activeEffects(theme: Theme, flags: Partial<Record<(typeof EFFECT_SETTING)[ThemeEffect], boolean>>): ThemeEffect[] {
  return (theme.effects ?? []).filter((e) => flags[EFFECT_SETTING[e]]);
}

/** A print-only look: a book page (serif, justified and hyphenated, indented paragraphs). */
const BOOK: Theme = {
  id: 'book', group: 'paper', name: 'Book', dark: false, kind: 'book',
  fonts: { ui: F('system'), doc: F('sourceSerif'), heading: F('sourceSerif'), code: F('plexMono') },
  vars: light({ '--fg': '#1a1a1a', '--fg-muted': '#555555', '--link': '#1a1a1a', '--accent': '#8b1e1e', '--code-bg': '#f4f2ee', '--code-fg': '#1a1a1a', '--quote': '#cfc8bb', '--border': '#d9d4ca' }),
};

/**
 * Output formats for PDF and HTML, chosen when exporting and independent of the sheet theme
 * (you can write on a CRT and print a clean document). "sheet" exports with the sheet theme.
 */
export const EXPORT_STYLES: { id: string; theme: Theme }[] = [
  { id: 'document', theme: THEMES.find((t) => t.id === 'modern')! },
  { id: 'book', theme: BOOK },
  { id: 'github', theme: THEMES.find((t) => t.id === 'github')! },
  { id: 'typewriter', theme: THEMES.find((t) => t.id === 'typewriter')! },
  { id: 'tractor', theme: THEMES.find((t) => t.id === 'tractor')! },
  { id: 'screenplay', theme: THEMES.find((t) => t.id === 'screenplay')! },
];

/** The theme an export uses: an output format, the sheet theme ("sheet"), or any theme id. */
export function exportStyleTheme(id: string, sheet: Theme): Theme {
  if (id === 'sheet' || id === 'current') return sheet;
  return EXPORT_STYLES.find((s) => s.id === id)?.theme ?? THEMES.find((t) => t.id === id) ?? EXPORT_STYLES[0].theme;
}

export function resolveTheme(id: string, systemDark: boolean): Theme {
  if (id === 'auto') id = systemDark ? 'modern-dark' : 'modern';
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
