import { describe, expect, it, vi } from 'vitest';
vi.mock('../state.svelte', () => ({ settings: { lang: 'en' } }));
import { DICTS, LANGUAGES } from '../i18n';
import en from '../locales/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('locales', () => {
  it('offer every language listed', () => {
    expect(Object.keys(DICTS).sort()).toEqual(LANGUAGES.map((l) => l.id).sort());
  });

  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang}: defines every key, non-empty, with the same {placeholders}`, () => {
      const keys = Object.keys(en) as (keyof typeof en)[];
      expect(Object.keys(dict).sort()).toEqual([...keys].sort());
      for (const k of keys) {
        expect(dict[k].trim(), `${lang} ${k}`).not.toBe('');
        expect(placeholders(dict[k]), `${lang} ${k}`).toEqual(placeholders(en[k]));
      }
    });
  }
});
