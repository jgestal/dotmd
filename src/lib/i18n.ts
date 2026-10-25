// UI strings. English is the reference (locales/en.ts); every other language must define every
// key (enforced by the type checker and a unit test that also checks {placeholders}).
import { settings } from './state.svelte';
import en, { type Key } from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import it from './locales/it';
import pt from './locales/pt';
import ca from './locales/ca';
import gl from './locales/gl';

export type { Key };

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'it', label: 'Italiano' },
  { id: 'pt', label: 'Português' },
  { id: 'ca', label: 'Català' },
  { id: 'gl', label: 'Galego' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['id'];

export const DICTS: Record<Lang, Record<Key, string>> = { en, es, fr, de, it, pt, ca, gl };

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = DICTS[settings.lang]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
