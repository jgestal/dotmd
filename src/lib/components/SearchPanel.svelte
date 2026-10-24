<script lang="ts">
  import { invoke, Channel } from '@tauri-apps/api/core';
  import Icon from './Icon.svelte';
  import { app, settings } from '../state.svelte';
  import { t } from '../i18n';
  import { openPath } from '../actions';
  import { escapeHtml } from '../render';

  interface LineHit { line: number; text: string; ranges: [number, number][] }
  type SearchEvent =
    | { kind: 'file'; path: string; rel: string; matches: LineHit[] }
    | { kind: 'done'; files: number; matches: number; truncated: boolean };

  let query = $state('');
  let regex = $state(false);
  let caseSensitive = $state(false);
  let results = $state<{ path: string; rel: string; matches: LineHit[]; open: boolean }[]>([]);
  let summary = $state<{ files: number; matches: number; truncated: boolean } | null>(null);
  let running = $state(false);
  let error = $state('');
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  $effect(() => {
    app.searchFocus;
    requestAnimationFrame(() => input?.select());
  });

  $effect(() => {
    const q = query, r = regex, c = caseSensitive, root = app.root;
    clearTimeout(timer);
    timer = setTimeout(() => run(q, r, c, root), 220);
  });

  async function run(q: string, r: boolean, c: boolean, root: string | null) {
    const my = ++seq;
    results = [];
    summary = null;
    error = '';
    if (!q.trim() || !root) { running = false; return; }
    running = true;
    const ch = new Channel<SearchEvent>();
    ch.onmessage = (ev) => {
      if (my !== seq) return;
      if (ev.kind === 'file') results.push({ path: ev.path, rel: ev.rel, matches: ev.matches, open: true });
      else { summary = ev; running = false; }
    };
    try {
      await invoke('search_folder', { root, query: q, regex: r, caseSensitive: c, onEvent: ch });
    } catch (e) {
      if (my === seq) { error = String(e); running = false; }
    }
  }

  function lineHtml(h: LineHit) {
    let out = '', last = 0;
    const chars = [...h.text];
    for (const [s, e] of h.ranges) {
      out += escapeHtml(chars.slice(last, s).join('')) + '<mark>' + escapeHtml(chars.slice(s, e).join('')) + '</mark>';
      last = e;
    }
    return out + escapeHtml(chars.slice(last).join(''));
  }

  async function reveal(path: string, line: number) {
    await openPath(path);
    app.reveal = { line, n: app.reveal.n + 1 };
  }
</script>

<div class="search">
  <div class="box">
    <input bind:this={input} bind:value={query} placeholder={t('search.placeholder')} spellcheck="false"
      onkeydown={(e) => e.key === 'Escape' && (query = '')} />
    <button class="opt" class:on={caseSensitive} title={t('search.case')} onclick={() => (caseSensitive = !caseSensitive)}>Aa</button>
    <button class="opt" class:on={regex} title={t('search.regex')} onclick={() => (regex = !regex)}>.*</button>
  </div>
  {#if !app.root}
    <p class="muted">{t('sidebar.noFolder')}</p>
  {:else if error}
    <p class="err">{error}</p>
  {:else if summary}
    <p class="muted">{t('search.summary', { m: summary.matches, f: summary.files })}{summary.truncated ? ' · ' + t('search.truncated') : ''}</p>
  {:else if running}
    <p class="muted">…</p>
  {/if}
  <div class="results">
    {#each results as r (r.path)}
      <button class="file" onclick={() => (r.open = !r.open)} title={r.path}>
        <span class="chev" class:open={r.open}><Icon name="right" size={11} stroke={2.2} /></span>
        <span class="rel">{r.rel}</span>
        <span class="count">{r.matches.length}</span>
      </button>
      {#if r.open}
        {#each r.matches as m}
          <button class="hit" onclick={() => reveal(r.path, m.line)}>
            <span class="ln">{m.line}</span>
            <span class="txt">{@html lineHtml(m)}</span>
          </button>
        {/each}
      {/if}
    {/each}
  </div>
</div>

<style>
  .search { display: flex; flex-direction: column; min-height: 0; flex: 1; }
  .box { display: flex; align-items: center; gap: 2px; margin: 6px 8px; position: relative; }
  .box input { flex: 1; min-width: 0; height: 28px; font-size: 12.5px; padding-right: 58px !important; }
  .opt { position: relative; width: 24px; height: 22px; border: 0; border-radius: 5px; background: none; color: var(--fg-muted); font: 600 11px var(--font-code); cursor: default; margin-left: -54px; }
  .opt + .opt { margin-left: 2px; }
  .opt.on { background: var(--accent); color: var(--accent-fg); }
  .muted, .err { margin: 2px 14px 6px; font-size: 11.5px; color: var(--fg-muted); }
  .err { color: #ff453a; }
  .results { flex: 1; overflow: auto; padding: 0 6px 12px; }
  .file, .hit { display: flex; align-items: center; gap: 6px; width: 100%; border: 0; background: none; color: var(--fg); text-align: left; cursor: default; border-radius: 5px; }
  .file { font: 600 12px var(--font-ui); padding: 4px 6px; }
  .file:hover, .hit:hover { background: var(--bg-hover); }
  .chev { display: inline-flex; transition: transform 0.12s; color: var(--fg-muted); }
  .chev.open { transform: rotate(90deg); }
  .rel { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
  .count { font-size: 10.5px; background: var(--bg-active); color: var(--fg-muted); border-radius: 8px; padding: 0 6px; }
  .hit { padding: 2px 6px 2px 22px; font: 12px var(--font-ui); align-items: baseline; }
  .ln { color: var(--fg-muted); font: 10.5px var(--font-code); min-width: 24px; text-align: right; }
  .txt { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .txt :global(mark) { background: color-mix(in srgb, var(--accent) 35%, transparent); color: inherit; border-radius: 2px; }
</style>
