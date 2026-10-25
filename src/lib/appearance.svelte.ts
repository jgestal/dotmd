import { app, settings } from './state.svelte';
import { EFFECT_SETTING, FONTS, THEMES, activeEffects, resolveTheme, type Theme, type ThemeEffect } from './themes';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function isDarkPreferred(): boolean {
  return settings.appearance === 'system' ? app.systemDark : settings.appearance === 'dark';
}

export function currentTheme(): Theme {
  return resolveTheme(settings.theme, isDarkPreferred());
}

/**
 * Light/dark toggle (top bar, View menu): switches to the theme's light/dark twin when it has one,
 * otherwise flips the "Automatic" theme between light and dark (back to "follow the OS" when that
 * matches the system).
 */
export function toggleAppearance() {
  const th = currentTheme();
  const wantDark = !th.dark;
  const twin = th.pair ? THEMES.find((x) => x.id === th.pair) : undefined;
  if (settings.theme !== 'auto' && twin && twin.dark === wantDark) {
    settings.theme = twin.id;
    return;
  }
  settings.theme = 'auto';
  settings.appearance = wantDark === app.systemDark ? 'system' : wantDark ? 'dark' : 'light';
}

/** Theme fonts with the user's overrides applied. */
export function fontsFor(theme: Theme) {
  const pick = (id: string, fallback: string) => (id !== 'theme' && FONTS[id] ? FONTS[id].stack : fallback);
  return {
    ui: theme.fonts.ui,
    doc: pick(settings.docFont, theme.fonts.doc),
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
  if (theme.writingFont && settings.docFont === 'theme') vars['--font-writing'] = theme.writingFont;
  if (settings.accent) {
    vars['--accent'] = settings.accent;
    vars['--link'] = settings.accent;
    vars['--sel'] = `color-mix(in srgb, ${settings.accent} 25%, transparent)`;
  }
  return vars;
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
      const theme = currentTheme();
      const root = document.documentElement;
      const vars = cssVars(theme);
      // Drop variables only the previous theme defined (e.g. --paper), so they don't leak.
      for (const k of appliedVars) if (!(k in vars)) root.style.removeProperty(k);
      appliedVars = new Set(Object.keys(vars));
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      root.dataset.theme = theme.id;
      root.style.colorScheme = theme.dark ? 'dark' : 'light';
      const c = root.classList;
      for (const cls of [...c]) if (cls.startsWith('theme-')) c.remove(cls);
      c.add(`theme-${theme.kind}`);
      c.toggle('dark', theme.dark);
      const on = activeEffects(theme, settings);
      for (const e of Object.keys(EFFECT_SETTING) as ThemeEffect[]) c.toggle(e, on.includes(e));
      c.toggle('zen', app.zen);
      c.toggle('writing-font', !!theme.writingFont && settings.docFont === 'theme');
      document.documentElement.lang = settings.lang;
      // Native title bar, menus and scroll bars follow the theme too.
      void getCurrentWindow().setTheme(theme.dark ? 'dark' : 'light').catch(() => {});
    });
    $effect(() => {
      customStyle!.textContent = settings.customCss;
    });
  });
}
