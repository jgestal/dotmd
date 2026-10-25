<script lang="ts">
  import { services } from '../container';
  import { open } from '@tauri-apps/plugin-dialog';
  import Icon from './Icon.svelte';
  import { app, settings } from '../state.svelte';
  import { t, type Key } from '../i18n';
  import { EXPORT_STYLES, exportStyleTheme } from '../themes';
  import { currentTheme } from '../appearance.svelte';
  import { basename, relative } from '../path';
  import { folderOf, workspaceFolders } from '../workspace.svelte';
  import { exportRequest, type Format } from '../exportRequest.svelte';

  let files = $state<string[]>([]);
  let picked = $state<Record<string, boolean>>({});
  let formats = $state<Record<Format, boolean>>({ pdf: true, html: false });
  let merge = $state(false);
  let toc = $state(false);
  let outDir = $state<string | null>(null);
  let engine = $state<string | null | undefined>(undefined);

  // Opened on one file (context menu, File ▸ Export to PDF…): preselect it and its format.
  const preset = exportRequest.preset;
  exportRequest.preset = null;
  if (preset) formats = { pdf: preset.format === 'pdf', html: preset.format === 'html' };

  $effect(() => {
    services.exporter.pdfEngineName().then((e) => (engine = e));
    const only = preset?.path;
    const roots = workspaceFolders();
    if (roots.length) {
      Promise.all(roots.map((path) => services.fs.listTree(path))).then((lists) => lists.flat()).then((list) => {
        files = only && !list.includes(only) ? [only, ...list] : list;
        picked = Object.fromEntries(files.map((f) => [f, f === (only ?? app.path)]));
        if (!(only ?? app.path) && files.length) picked[files[0]] = true;
      });
    } else if (only ?? app.path) {
      const f = (only ?? app.path)!;
      files = [f];
      picked = { [f]: true };
    }
  });

  const selected = $derived(files.filter((f) => picked[f]));
  const fmtList = $derived((Object.keys(formats) as Format[]).filter((k) => formats[k]));
  const label = (f: string) => {
    const root = folderOf(f);
    if (!root) return f;
    return workspaceFolders().length > 1 ? `${basename(root)}/${relative(root, f)}` : relative(root, f);
  };

  async function chooseDir() {
    const d = await open({ directory: true });
    if (typeof d === 'string') outDir = d;
  }

  // Live preview of the first selected document with the chosen format, paper and margins.
  let previewEl = $state<HTMLElement>();
  let previewHtml = $state('');
  let previewPages = $state(0);
  let previewBusy = $state(false);
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  const previewPath = $derived(selected[0] ?? (app.docOpen ? app.path : null));
  $effect(() => {
    // Re-render when anything that changes the printed result changes.
    void [settings.exportTheme, settings.pdfPageSize, settings.pdfMargin, toc, previewPath, previewEl?.clientWidth];
    if (!previewEl || (!previewPath && !app.content)) return;
    clearTimeout(previewTimer);
    previewBusy = true;
    previewTimer = setTimeout(async () => {
      try {
        const r = await exportRequest.preview(previewPath, toc, previewEl!.clientWidth);
        previewHtml = r.html;
        previewPages = r.pages;
      } catch (e) {
        console.warn('export preview failed', e);
      } finally {
        previewBusy = false;
      }
    }, 250);
  });
  const styleName = (id: string) => (id === 'sheet' ? t('export.styleSheet') : t(`export.style.${id}` as Key));

  async function run() {
    if (!selected.length && !app.path) {
      if (fmtList[0]) await exportRequest.quick(null, fmtList[0]);
      return;
    }
    // One file in one format: ask where to save it, like any Save dialog.
    if (selected.length === 1 && fmtList.length === 1 && !merge && !outDir) {
      app.exportOpen = false;
      await exportRequest.quick(selected[0], fmtList[0]);
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
        <p class="engine muted">{t('export.engine')}: {engine === undefined ? '…' : engine ? engine.split(/[\\/]/).pop() : t('export.noEngine')}</p>
      </div>

      <div class="look">
        <h3>{t('export.style')}</h3>
        <div class="styles" role="radiogroup">
          {#each [...EXPORT_STYLES.map((s) => s.id), 'sheet'] as id}
            {@const th = exportStyleTheme(id, currentTheme())}
            <button class="style" class:on={settings.exportTheme === id || (id === 'sheet' && settings.exportTheme === 'current')} role="radio" aria-checked={settings.exportTheme === id}
              onclick={() => (settings.exportTheme = id)} data-style={id}>
              <span class="chip" style="background:{th.vars['--paper'] ?? th.vars['--bg']};color:{th.vars['--fg']};font-family:{th.fonts.heading}">Aa</span>
              <span>{styleName(id)}</span>
            </button>
          {/each}
        </div>
        <div class="preview-head">
          <span>{t('export.preview')}</span>
          <span class="muted">{previewBusy ? '…' : previewPages ? t('export.pages', { n: previewPages }) : ''}</span>
        </div>
        <div class="preview" bind:this={previewEl}>
          {#if previewHtml}<iframe title={t('export.preview')} srcdoc={previewHtml} sandbox="allow-same-origin"></iframe>{/if}
        </div>
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
  .export { width: min(1180px, calc(100vw - 40px)); height: min(720px, calc(100vh - 60px)); display: flex; flex-direction: column; padding: 0; font-size: 13px; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 6px; }
  h2 { font-size: 15px; margin: 0; }
  .cols { display: grid; grid-template-columns: 1fr 0.9fr 1.3fr; gap: 18px; padding: 8px 18px; min-height: 0; flex: 1; }
  .opts { overflow: auto; min-height: 0; }
  .look { display: flex; flex-direction: column; min-height: 0; }
  .styles { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; margin-bottom: 10px; }
  .style { display: flex; align-items: center; gap: 6px; padding: 5px 6px; border: 1px solid var(--border); border-radius: 8px; background: none; color: var(--fg); font: 12px var(--font-ui); cursor: default; text-align: left; }
  .style.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .chip { flex: none; width: 24px; height: 24px; border-radius: 5px; display: grid; place-items: center; font-size: 12px; border: 1px solid rgba(0, 0, 0, 0.12); }
  .preview-head { display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin-bottom: 6px; }
  .preview { flex: 1; min-height: 0; border-radius: 10px; overflow: hidden; background: #8d8f93; border: 1px solid var(--border); }
  .preview iframe { width: 100%; height: 100%; border: 0; display: block; }
  .files { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
  .files-head { display: flex; justify-content: space-between; padding: 8px 10px; background: var(--bg-elev); border-bottom: 1px solid var(--border); font-size: 12px; }
  .link { border: 0; background: none; color: var(--accent); font: 12px var(--font-ui); cursor: default; }
  .file-list { overflow: auto; flex: 1; min-height: 0; padding: 4px; }
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
