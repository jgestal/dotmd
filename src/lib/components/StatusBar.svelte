<script lang="ts">
  import Popover from './Popover.svelte';
  import Icon from './Icon.svelte';
  import { app, settings, isDirty, type StatKey } from '../state.svelte';
  import { computeStats, countWords, formatMinutes, guessLang, toPlain, type Stats } from '../stats';
  import { t, type Key } from '../i18n';
  import { isMarkdown } from '../path';

  let stats = $state<Stats>(computeStats('', true, 'en'));
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const text = app.content;
    const md = !app.path || isMarkdown(app.path);
    clearTimeout(timer);
    timer = setTimeout(() => {
      stats = computeStats(text, md, guessLang(text, settings.lang));
      if (app.sessionStartWords < 0) app.sessionStartWords = stats.words;
    }, text.length > 100_000 ? 400 : 120);
  });

  const selWords = $derived(app.selection ? countWords(toPlain(app.selection)) : 0);
  const goal = $derived(settings.wordGoal > 0 ? Math.min(1, stats.words / settings.wordGoal) : 0);
  const sessionWords = $derived(app.sessionStartWords < 0 ? 0 : stats.words - app.sessionStartWords);
  const fmt = (n: number) => n.toLocaleString(settings.lang);

  const items = $derived.by(() => {
    const s = stats;
    const all: [StatKey, string][] = [
      ['words', `${fmt(s.words)} ${t('stats.words')}`],
      ['chars', `${fmt(s.chars)} ${t('stats.chars')}`],
      ['charsNoSpaces', `${fmt(s.charsNoSpaces)} ${t('stats.charsNoSpaces')}`],
      ['letters', `${fmt(s.letters)} ${t('stats.letters')}`],
      ['sentences', `${fmt(s.sentences)} ${t('stats.sentences')}`],
      ['paragraphs', `${fmt(s.paragraphs)} ${t('stats.paragraphs')}`],
      ['lines', `${fmt(s.lines)} ${t('stats.lines')}`],
      ['reading', `${formatMinutes(s.words, settings.readingWpm)} ${t('stats.reading')}`],
      ['speaking', `${formatMinutes(s.words, 130)} ${t('stats.speaking')}`],
      ['session', `${sessionWords >= 0 ? '+' : ''}${fmt(sessionWords)} ${t('stats.session')}`],
    ];
    return all.filter(([k]) => settings.stats[k]);
  });

  const readLabel = (r: number | null) => (r === null ? '—' : r >= 70 ? t('stats.easy') : r >= 50 ? t('stats.medium') : t('stats.hard'));
  const details: [Key, (s: Stats) => string][] = [
    ['stats.words', (s) => fmt(s.words)],
    ['stats.chars', (s) => fmt(s.chars)],
    ['stats.charsNoSpaces', (s) => fmt(s.charsNoSpaces)],
    ['stats.letters', (s) => fmt(s.letters)],
    ['stats.sentences', (s) => fmt(s.sentences)],
    ['stats.paragraphs', (s) => fmt(s.paragraphs)],
    ['stats.lines', (s) => fmt(s.lines)],
    ['stats.headings', (s) => fmt(s.headings)],
    ['stats.links', (s) => fmt(s.links)],
    ['stats.images', (s) => fmt(s.images)],
    ['stats.avgSentence', (s) => (s.sentences ? (s.words / s.sentences).toFixed(1) : '—')],
    ['stats.reading', (s) => formatMinutes(s.words, settings.readingWpm)],
    ['stats.speaking', (s) => formatMinutes(s.words, 130)],
  ];
</script>

<footer class="statusbar">
  <Popover align="left">
    {#snippet trigger({ toggle })}
      <button class="stats-btn" onclick={toggle} title={t('stats.title')}>
        {#if settings.stats.goal && settings.wordGoal > 0}
          <svg class="ring" viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" stroke-width="3" />
            <circle cx="10" cy="10" r="8" fill="none" stroke={goal >= 1 ? '#2da44e' : 'var(--accent)'} stroke-width="3"
              stroke-dasharray="{goal * 50.27} 50.27" transform="rotate(-90 10 10)" stroke-linecap="round" />
          </svg>
        {/if}
        {#each items as [k, label], i (k)}
          {#if i > 0}<span class="dot">·</span>{/if}<span>{label}</span>
        {/each}
        {#if settings.stats.selection && app.selection}
          <span class="dot">·</span><span class="sel">{fmt(selWords)} / {fmt([...app.selection].length)} {t('stats.selection')}</span>
        {/if}
      </button>
    {/snippet}
    {#snippet children()}
      <div class="details">
        <h4>{t('stats.title')}</h4>
        <dl>
          {#each details as [k, f]}
            <dt>{t(k)}</dt><dd>{f(stats)}</dd>
          {/each}
          <dt>{t('stats.readability')}</dt>
          <dd>
            {stats.readability ?? '—'}
            {#if stats.readability !== null}
              <span class="meter"><span style="width:{stats.readability}%"></span></span>
              <small>{readLabel(stats.readability)}</small>
            {/if}
          </dd>
        </dl>
        <label class="goal">
          <Icon name="target" size={14} /> {t('stats.setGoal')}
          <input type="number" min="0" step="100" bind:value={settings.wordGoal} />
        </label>
        {#if settings.wordGoal > 0}
          <div class="goalbar"><span style="width:{goal * 100}%"></span></div>
          <small class="muted">{fmt(stats.words)} / {fmt(settings.wordGoal)} · {Math.round(goal * 100)}%</small>
        {/if}
      </div>
    {/snippet}
  </Popover>
  <span class="spacer"></span>
  {#if app.pageCount && (app.mode === 'preview' || app.mode === 'split')}<span class="pages">{app.pageCount} {t('stats.pages')}</span>{/if}
  {#if isDirty()}<span class="dirty" title={t('top.unsaved')}>●</span>{/if}
</footer>

<style>
  .statusbar {
    display: flex; align-items: center; height: 26px; padding: 0 10px; flex-shrink: 0;
    border-top: 1px solid var(--border); background: var(--bg); color: var(--fg-muted); font: 11.5px var(--font-ui);
    font-variant-numeric: tabular-nums;
  }
  .stats-btn { display: flex; align-items: center; gap: 6px; border: 0; background: none; color: inherit; font: inherit; padding: 2px 6px; border-radius: 5px; cursor: default; white-space: nowrap; overflow: hidden; }
  .stats-btn:hover { background: var(--bg-hover); color: var(--fg); }
  .dot { opacity: 0.5; }
  .sel { color: var(--accent); }
  .spacer { flex: 1; }
  .dirty { color: var(--accent); font-size: 10px; }
  .pages { margin-right: 8px; }
  .details { padding: 8px 10px; width: 290px; font-size: 12px; }
  .statusbar :global(.popover) { top: auto; bottom: calc(100% + 6px); }
  h4 { margin: 0 0 8px; font-size: 12px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 3px 12px; margin: 0 0 10px; }
  dt { color: var(--fg-muted); text-transform: capitalize; }
  dd { margin: 0; text-align: right; color: var(--fg); display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
  .meter { display: inline-block; width: 50px; height: 5px; border-radius: 3px; background: var(--border); overflow: hidden; }
  .meter span { display: block; height: 100%; background: linear-gradient(90deg, #cf222e, #bf8700, #2da44e); }
  .goal { display: flex; align-items: center; gap: 6px; color: var(--fg-muted); }
  .goal input { width: 80px; margin-left: auto; }
  .goalbar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin: 8px 0 4px; }
  .goalbar span { display: block; height: 100%; background: var(--accent); transition: width 0.3s; }
  .muted { color: var(--fg-muted); }
</style>
