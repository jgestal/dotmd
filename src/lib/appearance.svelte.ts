// Two independent looks: the interface (sidebar, bars, dialogs) is neutral and only light or dark,
// and the sheet theme dresses the viewport where documents are read and written (`use:sheet`).
import { app, settings } from './state.svelte';
import { DEFAULT_CARET, FONTS, THEMES, activeEffects, resolveTheme, type Theme } from './themes';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function isDarkPreferred(): boolean {
  return settings.appearance === 'system' ? app.systemDark : settings.appearance === 'dark';
}

/** The interface palette: never changes with the sheet theme. */
export function chromeTheme(): Theme {
  return THEMES.find((t) => t.id === (isDarkPreferred() ? 'modern-dark' : 'modern'))!;
}

/** The sheet theme (reading and writing viewport; also the default look of exports). */
export function currentTheme(): Theme {
  return resolveTheme(settings.theme, isDarkPreferred());
}

/**
 * Light/dark toggle (top bar, View menu): flips the interface, and the sheet too when its theme has
 * a light/dark twin (or follows the interface, "Automatic").
 */
export function toggleAppearance() {
  const wantDark = !isDarkPreferred();
  settings.appearance = wantDark === app.systemDark ? 'system' : wantDark ? 'dark' : 'light';
  const th = resolveTheme(settings.theme, !wantDark);
  const twin = th.pair ? THEMES.find((x) => x.id === th.pair) : undefined;
  if (settings.theme !== 'auto' && twin && twin.dark === wantDark) settings.theme = twin.id;
}

/** Theme fonts with the user's overrides applied. */
export function fontsFor(theme: Theme) {
  const pick = (id: string, fallback: string) => (id !== 'theme' && FONTS[id] ? FONTS[id].stack : fallback);
  // Decorative faces (dot matrix, VT323, VGA) stay in headings unless the user wants them everywhere.
  const doc = settings.decorativeBody && theme.display ? theme.display : theme.fonts.doc;
  return {
    ui: theme.fonts.ui,
    doc: pick(settings.docFont, doc),
    heading: pick(settings.headingFont, settings.docFont !== 'theme' && settings.headingFont === 'theme' ? pick(settings.docFont, theme.fonts.heading) : theme.fonts.heading),
    code: pick(settings.codeFont, theme.fonts.code),
  };
}

/** CSS custom properties for a theme plus the typography settings. */
export function cssVars(theme: Theme): Record<string, string> {
  const f = fontsFor(theme);
  const vars: Record<string, string> = {
    ...theme.vars,
    '--font-ui': f.ui,
    '--font-doc': f.doc,
    '--font-heading': f.heading,
    '--font-code': f.code,
    '--doc-size': `${settings.fontSize}px`,
    '--line-height': String(settings.lineHeight),
    '--para-space': `${settings.paragraphSpacing}em`,
    '--doc-width': `${settings.docWidth}px`,
    '--fx': String(settings.effectStrength / 100),
  };
  if (settings.accent) {
    vars['--accent'] = settings.accent;
    vars['--link'] = settings.accent;
    vars['--sel'] = `color-mix(in srgb, ${settings.accent} 25%, transparent)`;
  }
  return vars;
}

/** Variables of a sheet: the theme's, minus the interface font, plus its caret. */
export function sheetVars(theme: Theme): Record<string, string> {
  const { '--font-ui': _ui, ...vars } = cssVars(theme);
  const c = { ...DEFAULT_CARET, ...theme.caret };
  vars['--caret-color'] = c.color ?? 'var(--accent)';
  vars['--caret-w'] = c.width ?? '2px';
  vars['--caret-rate'] = `${c.rate ?? 1200}ms`;
  return vars;
}

/** Classes of a sheet: theme kind, light/dark, active effects and caret style. */
export function sheetClasses(theme: Theme): string[] {
  const c = { ...DEFAULT_CARET, ...theme.caret };
  return [
    'sheet', `theme-${theme.kind}`, theme.dark ? 'sheet-dark' : 'sheet-light',
    ...activeEffects(theme, settings),
    `caret-${c.shape}`, `blink-${c.blink}`, ...(c.glow ? ['caret-glow'] : []),
    ...(settings.decorativeBody && theme.display ? ['decorative-body'] : []),
    // Paper themes keep the editors a plain paper surface; the ornaments are for reading and output.
    ...(theme.group === 'paper' && theme.vars['--paper'] ? ['paper-surface'] : []),
  ];
}

/** Class list of the current sheet, for `class="… {sheetClass()}"` next to `use:sheet`. */
export const sheetClass = () => sheetClasses(currentTheme()).join(' ');

/**
 * Svelte action: gives an element the variables of the current sheet theme. Pair it with
 * `sheetClass()` in the element's class attribute (Svelte owns that attribute).
 */
export function sheet(node: HTMLElement) {
  let vars = new Set<string>();
  const stop = $effect.root(() => {
    $effect(() => {
      const th = currentTheme();
      const next = sheetVars(th);
      for (const k of vars) if (!(k in next)) node.style.removeProperty(k);
      for (const [k, v] of Object.entries(next)) node.style.setProperty(k, v);
      vars = new Set(Object.keys(next));
      node.dataset.theme = th.id;
    });
  });
  return { destroy: stop };
}

let appliedVars = new Set<string>();

export function startAppearance() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  app.systemDark = mq.matches;
  mq.addEventListener('change', (e) => (app.systemDark = e.matches));

  let customStyle = document.getElementById('mdv-custom-css') as HTMLStyleElement | null;
  if (!customStyle) {
    customStyle = document.createElement('style');
    customStyle.id = 'mdv-custom-css';
    document.head.appendChild(customStyle);
  }

  $effect.root(() => {
    $effect(() => {
      // The interface: neutral light or dark palette.
      const chrome = chromeTheme();
      const root = document.documentElement;
      const vars = cssVars(chrome);
      for (const k of appliedVars) if (!(k in vars)) root.style.removeProperty(k);
      appliedVars = new Set(Object.keys(vars));
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      root.dataset.theme = currentTheme().id;
      root.style.colorScheme = chrome.dark ? 'dark' : 'light';
      const c = root.classList;
      c.toggle('dark', chrome.dark);
      c.toggle('zen', app.zen);
      document.documentElement.lang = settings.lang;
      // Native title bar, menus and scroll bars follow the interface.
      void getCurrentWindow().setTheme(chrome.dark ? 'dark' : 'light').catch(() => {});
    });
    $effect(() => {
      customStyle!.textContent = settings.customCss;
    });
  });
}

