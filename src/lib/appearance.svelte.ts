import { app, settings } from './state.svelte';
import { FONTS, resolveTheme, type Theme } from './themes';

export function currentTheme(): Theme {
  return resolveTheme(settings.theme, app.systemDark);
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
  };
  if (settings.accent) {
    vars['--accent'] = settings.accent;
    vars['--link'] = settings.accent;
    vars['--sel'] = `color-mix(in srgb, ${settings.accent} 25%, transparent)`;
  }
  return vars;
}

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
      for (const [k, v] of Object.entries(cssVars(theme))) root.style.setProperty(k, v);
      root.dataset.theme = theme.id;
      root.style.colorScheme = theme.dark ? 'dark' : 'light';
      const c = root.classList;
      c.remove('theme-normal', 'theme-typewriter', 'theme-crt');
      c.add(`theme-${theme.kind}`);
      c.toggle('dark', theme.dark);
      c.toggle('scanlines', theme.kind === 'crt' && settings.crtScanlines);
      c.toggle('glow', theme.kind === 'crt' && settings.crtGlow);
      c.toggle('flicker', theme.kind === 'crt' && settings.crtFlicker);
      c.toggle('curvature', theme.kind === 'crt' && settings.crtCurvature);
      c.toggle('paper', theme.kind === 'typewriter' && settings.paperTexture);
      c.toggle('ink', theme.kind === 'typewriter' && settings.inkVariation);
      c.toggle('zen', app.zen);
      document.documentElement.lang = settings.lang;
    });
    $effect(() => {
      customStyle!.textContent = settings.customCss;
    });
  });
}
