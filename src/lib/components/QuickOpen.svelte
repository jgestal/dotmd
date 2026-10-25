<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import Picker from './Picker.svelte';
  import { app, session } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, dirname, relative } from '../path';
  import { fuzzyMatch, highlight } from '../fuzzy';
  import { openPath } from '../actions';
  import { workspaceFolders } from '../workspace.svelte';

  interface Hit { path: string; rel: string; score: number; indices: number[] }

  async function items(q: string) {
    const label = (h: Hit) => ({ item: h.path, html: highlight(h.rel, h.indices), detail: '' });
    if (!q.trim()) {
      // Empty query: recent files first, then the folder.
      const recent = session.recent.filter((p) => p !== app.path).slice(0, 8);
      const rel = (p: string) => (app.root && p.startsWith(app.root) ? relative(app.root, p) : basename(p));
      return recent.map((p) => ({ item: p, html: highlight(rel(p), []), detail: app.root && p.startsWith(app.root) ? '' : dirname(p) }));
    }
    const roots = workspaceFolders();
    if (!roots.length) {
      return session.recent
        .map((p) => ({ p, m: fuzzyMatch(q, basename(p)) }))
        .filter((x) => x.m)
        .sort((a, b) => b.m!.score - a.m!.score)
        .map(({ p, m }) => ({ item: p, html: highlight(basename(p), m!.indices), detail: dirname(p) }));
    }
    const lists = await Promise.all(roots.map((root) => invoke<Hit[]>('fuzzy_find', { root, query: q, limit: 60 }).then((hits) =>
      // With several folders the folder name prefixes each path (its letters do not count as matches).
      roots.length > 1 ? hits.map((h) => ({ ...h, rel: `${basename(root)}/${h.rel}`, indices: h.indices.map((i) => i + basename(root).length + 1) })) : hits)));
    return lists.flat().sort((a, b) => b.score - a.score).slice(0, 60).map(label);
  }
</script>

<Picker placeholder={t('quick.placeholder')} {items} onpick={(p: string) => openPath(p)} onclose={() => (app.quickOpen = false)} />
