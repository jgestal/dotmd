import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EFFECT_SETTING, FONTS, THEMES, activeEffects, resolveTheme } from '../themes';

const byId = (id: string) => THEMES.find((t) => t.id === id)!;

describe('themes', () => {
  it('have unique ids and the core colours', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) for (const v of ['--bg', '--fg', '--accent', '--border']) expect(t.vars[v], `${t.id} ${v}`).toBeTruthy();
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
