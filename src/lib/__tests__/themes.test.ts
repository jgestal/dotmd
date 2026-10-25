import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EFFECT_SETTING, EXPORT_STYLES, FONTS, THEMES, THEME_GROUPS, activeEffects, exportStyleTheme, resolveTheme } from '../themes';

const byId = (id: string) => THEMES.find((t) => t.id === id)!;

// WCAG 2 contrast ratio of a colour (hex or rgba, blended over the background) against the background.
function rgba(c: string): number[] {
  const hex = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).concat(hex[2] ? parseInt(hex[2], 16) / 255 : 1);
  const fn = c.match(/^rgba?\(([^)]+)\)$/);
  if (fn) { const p = fn[1].split(',').map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  throw new Error(`unparsed colour ${c}`);
}
const lum = (c: number[]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
export function contrast(fg: string, bg: string): number {
  const b = rgba(bg), f = rgba(fg);
  const mixed = [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const [hi, lo] = [lum(mixed), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('themes', () => {
  it('have unique ids and the core colours', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) for (const v of ['--bg', '--fg', '--accent', '--border']) expect(t.vars[v], `${t.id} ${v}`).toBeTruthy();
  });

  it('are legible: body text ≥ 7:1, secondary text, links and code ≥ 4.5:1 (WCAG)', () => {
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1); // the formula itself
    expect(contrast('rgba(0,0,0,.5)', '#ffffff')).toBeCloseTo(3.95, 1);
    const fails: string[] = [];
    for (const t of THEMES) {
      const bg = t.vars['--paper'] ?? t.vars['--bg'];
      const need: [string, number][] = [['--fg', 7], ['--fg-muted', 4.5], ['--link', 4.5], ['--code-fg', 4.5]];
      for (const [k, min] of need) {
        const r = contrast(t.vars[k], bg);
        if (r < min) fails.push(`${t.id} ${k} ${r.toFixed(2)} < ${min}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('pair light and dark twins both ways', () => {
    for (const t of THEMES.filter((t) => t.pair)) {
      const twin = byId(t.pair!);
      expect(twin, t.id).toBeDefined();
      expect(twin.dark).not.toBe(t.dark);
    }
    expect(byId('calm').pair).toBe('calm-dark');
    expect(byId('calm-dark').pair).toBe('calm');
  });

  it('only declare effects that exist, and CRT/paper effects where they belong', () => {
    for (const t of THEMES) for (const e of t.effects ?? []) expect(EFFECT_SETTING[e], `${t.id} ${e}`).toBeDefined();
    expect(byId('crt-green').effects).toContain('scanlines');
    expect(byId('modern').effects ?? []).toEqual([]);
    expect(byId('typewriter').effects).toEqual(['paper', 'ink']);
  });

  it('activeEffects keeps the supported effects the user left on', () => {
    const flags = { crtScanlines: true, crtGlow: false, crtFlicker: true, crtCurvature: true, paperTexture: true, inkVariation: false };
    expect(activeEffects(byId('crt-amber'), flags)).toEqual(['scanlines', 'flicker', 'curvature']);
    expect(activeEffects(byId('typewriter'), flags)).toEqual(['paper']);
    expect(activeEffects(byId('github'), flags)).toEqual([]);
  });

  it('suggest a sound for the retro themes', () => {
    expect(byId('typewriter').sound).toBe('typewriter');
    expect(byId('screenplay').sound).toBe('typewriter');
    expect(byId('msdos').sound).toBe('mechanical');
  });

  it('belong to a group, and decorative paper keeps a readable writing font', () => {
    for (const t of THEMES) expect(THEME_GROUPS, t.id).toContain(t.group);
    expect(byId('tractor').group).toBe('paper');
    for (const id of ['tractor', 'crt-green', 'crt-amber', 'msdos']) {
      expect(byId(id).fonts.doc, id).toContain('IBM Plex Mono'); // legible body text
      expect(byId(id).display, id).toBeTruthy(); // decorative face kept for headings
    }
  });

  it('offer output formats independent of the sheet theme', () => {
    const crt = byId('crt-green');
    expect(EXPORT_STYLES.map((s) => s.id)).toEqual(['document', 'book', 'github', 'typewriter', 'tractor', 'screenplay']);
    expect(exportStyleTheme('document', crt).id).toBe('modern');
    expect(exportStyleTheme('book', crt).kind).toBe('book');
    expect(exportStyleTheme('sheet', crt)).toBe(crt);
    expect(exportStyleTheme('current', crt)).toBe(crt); // older settings
    expect(exportStyleTheme('nord', crt).id).toBe('nord'); // older settings named a theme
    expect(exportStyleTheme('bogus', crt).id).toBe('modern');
  });

  it('resolve "auto" by the system appearance', () => {
    expect(resolveTheme('auto', false).dark).toBe(false);
    expect(resolveTheme('auto', true).dark).toBe(true);
    expect(resolveTheme('calm', true).id).toBe('calm');
  });

  it('every bundled font family has an @font-face or an npm import', () => {
    const css = readFileSync('src/fonts.css', 'utf8');
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    for (const fam of ['iA Writer Quattro S', 'iA Writer Mono S', 'Px437 IBM VGA']) expect(css).toContain(`'${fam}'`);
    for (const pkg of ['jetbrains-mono', 'atkinson-hyperlegible-next', 'lexend', 'source-serif-4']) expect(layout).toContain(`@fontsource/${pkg}`);
    expect(Object.keys(FONTS)).toEqual(expect.arrayContaining(['iaQuattro', 'iaMono', 'vga', 'jetbrains', 'atkinson', 'lexend', 'sourceSerif']));
  });
});
