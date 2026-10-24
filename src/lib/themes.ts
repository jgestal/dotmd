// Themes are data, not CSS, so the same values can style the app, Mermaid and exported files.

export type ThemeKind = 'normal' | 'typewriter' | 'crt' | 'tractor';

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  kind: ThemeKind;
  fonts: { ui: string; doc: string; heading: string; code: string };
  vars: Record<string, string>;
}

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
    id: 'modern', name: 'Modern', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: light(),
  },
  {
    id: 'modern-dark', name: 'Modern Dark', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: dark(),
  },
  {
    id: 'github', name: 'GitHub', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('system'), heading: F('system'), code: F('mono') },
    vars: light({ '--bg-elev': '#f6f8fa', '--fg': '#1f2328', '--fg-muted': '#59636e', '--border': '#d1d9e0', '--accent': '#0969da', '--link': '#0969da', '--code-bg': '#f6f8fa', '--code-fg': '#1f2328', '--quote': '#d1d9e0' }),
  },
  {
    id: 'paper', name: 'Paper', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('literata'), heading: F('literata'), code: F('plexMono') },
    vars: light({ '--bg': '#f7f2e8', '--bg-elev': '#efe8da', '--fg': '#3a3128', '--fg-muted': '#7d7060', '--fg-dim': 'rgba(58,49,40,.28)', '--border': '#e0d6c3', '--accent': '#b5651d', '--link': '#9a4f12', '--code-bg': '#eee5d3', '--code-fg': '#8b3a1a', '--quote': '#d8c9ad', '--sel': 'rgba(181,101,29,.2)' }),
  },
  {
    id: 'typewriter', name: 'Typewriter', dark: false, kind: 'typewriter',
    fonts: { ui: F('courier'), doc: F('courier'), heading: F('elite'), code: F('courier') },
    vars: light({ '--bg': '#f1ead6', '--bg-elev': '#e8dfc6', '--bg-hover': 'rgba(60,40,10,.07)', '--bg-active': 'rgba(60,40,10,.12)', '--fg': '#26231f', '--fg-muted': '#6d6556', '--fg-dim': 'rgba(38,35,31,.25)', '--border': '#d6caa9', '--accent': '#a5281b', '--link': '#7b1f14', '--code-bg': '#e6dcc0', '--code-fg': '#26231f', '--quote': '#bfae86', '--sel': 'rgba(165,40,27,.18)', '--mark': '#f0d56a', '--syn-keyword': '#a5281b', '--syn-string': '#3d5a2a', '--syn-number': '#6d4c1a', '--syn-comment': '#8c826d', '--syn-func': '#26231f', '--syn-type': '#6d4c1a' }),
  },
  {
    id: 'tractor', name: 'Continuous Paper', dark: false, kind: 'tractor',
    fonts: { ui: F('system'), doc: F('doto'), heading: F('doto'), code: F('doto') },
    vars: light({ '--bg': '#e4e6df', '--bg-elev': '#dcdfd6', '--bg-hover': 'rgba(40,60,40,.07)', '--bg-active': 'rgba(40,60,40,.12)', '--paper': '#fbfcf7', '--band': 'rgba(150, 196, 156, .30)', '--perf': '#bfc6b4', '--fg': '#2a2e35', '--fg-muted': '#6a7068', '--fg-dim': 'rgba(42,46,53,.25)', '--border': '#cdd2c5', '--accent': '#2f7d4f', '--link': '#2b5c99', '--code-bg': 'rgba(60,80,60,.07)', '--code-fg': '#2a2e35', '--quote': '#b9c4b0', '--sel': 'rgba(47,125,79,.2)', '--mark': '#f2e58f', '--syn-keyword': '#2f7d4f', '--syn-string': '#8a4b2a', '--syn-number': '#2b5c99', '--syn-comment': '#8b9186', '--syn-func': '#2a2e35', '--syn-type': '#5b4a8a' }),
  },
  {
    id: 'crt-green', name: 'CRT Phosphor', dark: true, kind: 'crt',
    fonts: { ui: F('vt323'), doc: F('vt323'), heading: F('vt323'), code: F('vt323') },
    vars: dark({ '--bg': '#040b05', '--bg-elev': '#071209', '--bg-hover': 'rgba(51,255,102,.08)', '--bg-active': 'rgba(51,255,102,.16)', '--fg': '#3dff73', '--fg-muted': '#22a849', '--fg-dim': 'rgba(61,255,115,.25)', '--border': '#0f3a19', '--accent': '#3dff73', '--accent-fg': '#021004', '--link': '#a6ffbf', '--code-bg': '#08200d', '--code-fg': '#a6ffbf', '--quote': '#1b6b30', '--sel': 'rgba(61,255,115,.25)', '--mark': '#1d6b33', '--glow': 'rgba(61,255,115,.55)', '--syn-keyword': '#a6ffbf', '--syn-string': '#7dffa0', '--syn-number': '#d4ffe0', '--syn-comment': '#1f8a3e', '--syn-func': '#5cff8a', '--syn-type': '#c3ffd4' }),
  },
  {
    id: 'crt-amber', name: 'CRT Amber', dark: true, kind: 'crt',
    fonts: { ui: F('vt323'), doc: F('vt323'), heading: F('vt323'), code: F('vt323') },
    vars: dark({ '--bg': '#0d0800', '--bg-elev': '#140c01', '--bg-hover': 'rgba(255,176,0,.08)', '--bg-active': 'rgba(255,176,0,.16)', '--fg': '#ffb000', '--fg-muted': '#b07a00', '--fg-dim': 'rgba(255,176,0,.25)', '--border': '#3d2a00', '--accent': '#ffb000', '--accent-fg': '#140c00', '--link': '#ffd27a', '--code-bg': '#221600', '--code-fg': '#ffd27a', '--quote': '#7a5400', '--sel': 'rgba(255,176,0,.25)', '--mark': '#6b4a00', '--glow': 'rgba(255,176,0,.5)', '--crt-hue': '0deg', '--syn-keyword': '#ffd27a', '--syn-string': '#ffc54d', '--syn-number': '#ffe6b0', '--syn-comment': '#8a6000', '--syn-func': '#ffbf33', '--syn-type': '#ffdd99' }),
  },
  {
    id: 'nord', name: 'Nord', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('plexMono') },
    vars: dark({ '--bg': '#2e3440', '--bg-elev': '#3b4252', '--fg': '#e5e9f0', '--fg-muted': '#a3abba', '--fg-dim': 'rgba(229,233,240,.25)', '--border': '#434c5e', '--accent': '#88c0d0', '--accent-fg': '#2e3440', '--link': '#88c0d0', '--code-bg': '#3b4252', '--code-fg': '#ebcb8b', '--quote': '#4c566a', '--sel': 'rgba(136,192,208,.3)', '--syn-keyword': '#81a1c1', '--syn-string': '#a3be8c', '--syn-number': '#b48ead', '--syn-comment': '#616e88', '--syn-func': '#88c0d0', '--syn-type': '#8fbcbb' }),
  },
  {
    id: 'solarized', name: 'Solarized Light', dark: false, kind: 'normal',
    fonts: { ui: F('system'), doc: F('plexSerif'), heading: F('plexSerif'), code: F('plexMono') },
    vars: light({ '--bg': '#fdf6e3', '--bg-elev': '#eee8d5', '--fg': '#3c4a50', '--fg-muted': '#839496', '--fg-dim': 'rgba(60,74,80,.28)', '--border': '#e4dcc4', '--accent': '#268bd2', '--link': '#268bd2', '--code-bg': '#eee8d5', '--code-fg': '#d33682', '--quote': '#d9cfb0', '--syn-keyword': '#859900', '--syn-string': '#2aa198', '--syn-number': '#d33682', '--syn-comment': '#93a1a1', '--syn-func': '#268bd2', '--syn-type': '#b58900' }),
  },
  {
    id: 'dracula', name: 'Dracula', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('inter'), heading: F('inter'), code: F('mono') },
    vars: dark({ '--bg': '#282a36', '--bg-elev': '#21222c', '--fg': '#f8f8f2', '--fg-muted': '#a4a8c2', '--border': '#3a3d4d', '--accent': '#bd93f9', '--accent-fg': '#282a36', '--link': '#8be9fd', '--code-bg': '#343746', '--code-fg': '#ff79c6', '--quote': '#6272a4', '--sel': 'rgba(189,147,249,.3)', '--syn-keyword': '#ff79c6', '--syn-string': '#f1fa8c', '--syn-number': '#bd93f9', '--syn-comment': '#6272a4', '--syn-func': '#50fa7b', '--syn-type': '#8be9fd' }),
  },
  {
    id: 'contrast', name: 'High Contrast', dark: true, kind: 'normal',
    fonts: { ui: F('system'), doc: F('system'), heading: F('system'), code: F('mono') },
    vars: dark({ '--bg': '#000000', '--bg-elev': '#0d0d0d', '--fg': '#ffffff', '--fg-muted': '#d0d0d0', '--fg-dim': 'rgba(255,255,255,.35)', '--border': '#ffffff', '--accent': '#ffd60a', '--accent-fg': '#000000', '--link': '#7cc4ff', '--code-bg': '#1a1a1a', '--code-fg': '#ffd60a', '--quote': '#ffffff' }),
  },
];

export function resolveTheme(id: string, systemDark: boolean): Theme {
  if (id === 'auto') id = systemDark ? 'modern-dark' : 'modern';
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
