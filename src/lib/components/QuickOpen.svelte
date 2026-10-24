<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import Picker from './Picker.svelte';
  import { app, session } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, dirname, relative } from '../path';
  import { fuzzyMatch, highlight } from '../fuzzy';
  import { openPath } from '../actions';

  interface Hit { path: string; rel: string; score: number; indices: number[] }

  async function items(q: string) {
    const label = (h: Hit) => ({ item: h.path, html: highlight(h.rel, h.indices), detail: '' });
    if (!q.trim()) {
      // Empty query: recent files first, then the folder.
      const recent = session.recent.filter((p) => p !== app.path).slice(0, 8);
      const rel = (p: string) => (app.root && p.startsWith(app.root) ? relative(app.root, p) : basename(p));
      return recent.map((p) => ({ item: p, html: highlight(rel(p), []), detail: app.root && p.startsWith(app.root) ? '' : dirname(p) }));
    }
    if (!app.root) {
      return session.recent
        .map((p) => ({ p, m: fuzzyMatch(q, basename(p)) }))
        .filter((x) => x.m)
        .sort((a, b) => b.m!.score - a.m!.score)
        .map(({ p, m }) => ({ item: p, html: highlight(basename(p), m!.indices), detail: dirname(p) }));
    }
    const hits = await invoke<Hit[]>('fuzzy_find', { root: app.root, query: q, limit: 60 });
    return hits.map(label);
  }
</script>

<Picker placeholder={t('quick.placeholder')} {items} onpick={(p: string) => openPath(p)} onclose={() => (app.quickOpen = false)} />
