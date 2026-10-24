<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import Icon from './Icon.svelte';
  import { app, settings } from '../state.svelte';
  import { t } from '../i18n';
  import { relative } from '../path';
  import { exportRequest, type Format } from '../exportRequest.svelte';

  let files = $state<string[]>([]);
  let picked = $state<Record<string, boolean>>({});
  let formats = $state<Record<Format, boolean>>({ pdf: true, html: false });
  let merge = $state(false);
  let toc = $state(false);
  let outDir = $state<string | null>(null);
  let engine = $state<string | null | undefined>(undefined);

  $effect(() => {
    invoke<string | null>('pdf_engine').then((e) => (engine = e));
    if (app.root) {
      invoke<string[]>('list_tree', { path: app.root }).then((list) => {
        files = list;
        picked = Object.fromEntries(list.map((f) => [f, f === app.path]));
        if (!app.path && list.length) picked[list[0]] = true;
      });
    } else if (app.path) {
      files = [app.path];
      picked = { [app.path]: true };
    }
  });

  const selected = $derived(files.filter((f) => picked[f]));
  const fmtList = $derived((Object.keys(formats) as Format[]).filter((k) => formats[k]));
  const label = (f: string) => (app.root ? relative(app.root, f) : f);

  async function chooseDir() {
    const d = await open({ directory: true });
    if (typeof d === 'string') outDir = d;
  }

  async function run() {
    if (!selected.length && !app.path) {
      if (fmtList[0]) await exportRequest.quick(null, fmtList[0]);
      return;
    }
    const ok = await exportRequest.run({ files: selected, formats: fmtList, merge, outDir, toc });
    if (ok) app.exportOpen = false;
  }
</script>

<div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && !exportRequest.running && (app.exportOpen = false)}>
  <div class="dialog export" role="dialog" aria-label={t('export.title')}>
    <header>
      <h2>{t('export.title')}</h2>
      <button class="tb" onclick={() => (app.exportOpen = false)} title={t('common.close')}><Icon name="x" /></button>
    </header>

    <div class="cols">
      <div class="files">
        <div class="files-head">
          <b>{t('export.files')} ({selected.length}/{files.length})</b>
          <span>
            <button class="link" onclick={() => (picked = Object.fromEntries(files.map((f) => [f, true])))}>{t('export.selectAll')}</button>
            <button class="link" onclick={() => (picked = {})}>{t('export.selectNone')}</button>
          </span>
        </div>
        <div class="file-list">
          {#each files as f (f)}
            <label class="file" class:current={f === app.path}><input type="checkbox" bind:checked={picked[f]} /> <span>{label(f)}</span></label>
          {:else}
            <p class="muted">{app.content ? t('export.current') : t('export.noFiles')}</p>
          {/each}
        </div>
      </div>

      <div class="opts">
        <h3>{t('export.formats')}</h3>
        <div class="formats">
          <label class="fmt" class:on={formats.pdf}><input type="checkbox" bind:checked={formats.pdf} /> PDF</label>
          <label class="fmt" class:on={formats.html}><input type="checkbox" bind:checked={formats.html} /> HTML</label>
        </div>
        <label class="check"><input type="checkbox" bind:checked={merge} /> {t('export.merge')}</label>
        <label class="check"><input type="checkbox" bind:checked={toc} /> {t('export.toc')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.exportEmbedFonts} /> {t('export.embedFonts')}</label>

        <h3>{t('export.outDir')}</h3>
        <div class="out">
          <span class="path" title={outDir ?? ''}>{outDir ?? t('export.sameDir')}</span>
          <button class="btn" onclick={chooseDir}>{t('export.choose')}</button>
        </div>

        <h3>PDF</h3>
        <div class="row">
          <span>{t('export.page')}</span>
          <select bind:value={settings.pdfPageSize}>{#each ['A4', 'Letter', 'A5', 'Legal'] as p}<option>{p}</option>{/each}</select>
        </div>
        <div class="row">
          <span>{t('export.margin')}</span>
          <input type="number" min="0" max="50" bind:value={settings.pdfMargin} />
        </div>
        <div class="row">
          <span>{t('export.theme')}</span>
          <select bind:value={settings.exportTheme}>
            <option value="current">{t('export.themeCurrent')}</option>
            <option value="modern">Modern</option><option value="github">GitHub</option>
            <option value="paper">Paper</option><option value="typewriter">Typewriter</option><option value="tractor">Continuous Paper</option>
          </select>
        </div>
        <p class="engine muted">{t('export.engine')}: {engine === undefined ? '…' : engine ? engine.split(/[\\/]/).pop() : t('export.noEngine')}</p>
      </div>
    </div>

    <footer>
      {#if exportRequest.running}
        <div class="progress"><span style="width:{(exportRequest.done / Math.max(1, exportRequest.total)) * 100}%"></span></div>
        <span class="muted">{t('export.running', { i: exportRequest.done, n: exportRequest.total })}</span>
        <button class="btn" onclick={() => (exportRequest.cancelled = true)}>{t('export.cancel')}</button>
      {:else}
        {#if exportRequest.errors.length}
          <details class="errors"><summary>{t('export.errors')} ({exportRequest.errors.length})</summary>{#each exportRequest.errors as e}<div>{e}</div>{/each}</details>
        {/if}
        <span class="spacer"></span>
        <button class="btn" onclick={() => (app.exportOpen = false)}>{t('common.cancel')}</button>
        <button class="btn primary" disabled={!fmtList.length || (!selected.length && !app.content)} onclick={run}>{t('export.run')}</button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .export { width: min(820px, calc(100vw - 40px)); max-height: calc(100vh - 60px); display: flex; flex-direction: column; padding: 0; font-size: 13px; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 6px; }
  h2 { font-size: 15px; margin: 0; }
  .cols { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; padding: 8px 18px; min-height: 0; flex: 1; }
  .files { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .files-head { display: flex; justify-content: space-between; padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); font-size: 12px; }
  .link { border: 0; background: none; color: var(--accent); font: 12px var(--font-ui); cursor: default; }
  .file-list { overflow: auto; max-height: 380px; padding: 4px; }
  .file { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border-radius: 5px; font-size: 12.5px; }
  .file:hover { background: var(--bg-hover); }
  .file.current span { font-weight: 600; }
  .file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 14px 0 8px; }
  h3:first-child { margin-top: 0; }
  .formats { display: flex; gap: 8px; margin-bottom: 8px; }
  .fmt { flex: 1; display: flex; gap: 6px; align-items: center; justify-content: center; padding: 10px; border: 1px solid var(--border); border-radius: 9px; font-weight: 600; }
  .fmt.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .check { display: flex; align-items: center; gap: 8px; min-height: 26px; }
  .out { display: flex; gap: 8px; align-items: center; }
  .path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--fg-muted); direction: rtl; text-align: left; }
  .row { display: flex; justify-content: space-between; align-items: center; min-height: 30px; }
  .row input { width: 70px; }
  .engine { font-size: 11.5px; margin-top: 10px; }
  .muted { color: var(--fg-muted); }
  footer { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-top: 1px solid var(--border); }
  .spacer { flex: 1; }
  .progress { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
  .progress span { display: block; height: 100%; background: var(--accent); transition: width 0.2s; }
  .errors { font-size: 11.5px; color: #ff453a; max-width: 60%; }
</style>
