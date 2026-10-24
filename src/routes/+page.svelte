<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
  import Icon from '$lib/components/Icon.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import Preview from '$lib/components/Preview.svelte';
  import SourceEditor from '$lib/components/SourceEditor.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import Settings from '$lib/components/Settings.svelte';
  import ExportDialog from '$lib/components/ExportDialog.svelte';
  import PromptDialog from '$lib/components/PromptDialog.svelte';
  import Welcome from '$lib/components/Welcome.svelte';
  import { app, settings, session, isDirty, type Mode } from '$lib/state.svelte';
  import { startAppearance } from '$lib/appearance.svelte';
  import { t, type Key } from '$lib/i18n';
  import { isMac, isPlainText, modKey } from '$lib/path';
  import {
    confirmDiscard, docName, handleDroppedPaths, newDoc, onExternalChange, openFileDialog, openFolder, openPath, saveDoc, toggleZen,
  } from '$lib/actions';

  startAppearance();

  let syncLine = $state(0);
  let lastEditMode: Mode = 'source';
  const plain = $derived(isPlainText(app.path));
  const editing = $derived(app.mode !== 'preview');

  const MODES: [Mode, Key, Key, string][] = [
    ['preview', 'mode.preview', 'mode.previewTip', 'preview'],
    ['source', 'mode.source', 'mode.sourceTip', 'source'],
    ['split', 'mode.split', 'mode.splitTip', 'split'],
    ['visual', 'mode.visual', 'mode.visualTip', 'visual'],
  ];

  function setMode(m: Mode) {
    if (plain && m === 'visual') return;
    if (m !== 'preview') lastEditMode = m;
    app.mode = m;
  }

  function onKeydown(e: KeyboardEvent) {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (e.key === 'Escape' && app.zen && !app.settingsOpen && !app.exportOpen) { toggleZen(); return; }
    if (e.key === 'F11') { e.preventDefault(); toggleZen(); return; }
    if (!mod) return;
    const k = e.key.toLowerCase();
    const run = (fn: () => unknown) => { e.preventDefault(); fn(); };
    if (k === 'o' && e.shiftKey) run(() => openFolder());
    else if (k === 'o') run(openFileDialog);
    else if (k === 'n') run(newDoc);
    else if (k === 's') run(() => saveDoc(e.shiftKey));
    else if (k === '\\') run(() => (app.sidebar = !app.sidebar));
    else if (k === 'e' && !e.shiftKey && app.docOpen) run(() => setMode(app.mode === 'preview' ? lastEditMode : 'preview'));
    else if (k === 'e' && e.shiftKey) run(() => (app.exportOpen = true));
    else if (k === ',') run(() => (app.settingsOpen = !app.settingsOpen));
    else if (k === 'enter' && e.shiftKey) run(toggleZen);
    else if (k === 'p' && e.shiftKey) run(() => window.print());
    else if (['1', '2', '3', '4'].includes(e.key) && !e.altKey && app.docOpen) run(() => setMode(MODES[Number(e.key) - 1][0]));
    else if (k === '=' || k === '+') run(() => (settings.fontSize = Math.min(32, settings.fontSize + 1)));
    else if (k === '-') run(() => (settings.fontSize = Math.max(10, settings.fontSize - 1)));
    else if (k === '0' && !e.altKey) run(() => (settings.fontSize = 16));
  }

  // Autosave a couple of seconds after typing stops.
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    app.content;
    clearTimeout(autosaveTimer);
    if (settings.autosave && app.path && isDirty()) autosaveTimer = setTimeout(() => saveDoc(), 1500);
  });

  onMount(() => {
    const win = getCurrentWindow();
    const unlisten: Promise<() => void>[] = [];

    unlisten.push(listen<string>('file-changed', (e) => onExternalChange(e.payload)));
    unlisten.push(listen<string[]>('open-paths', () => invoke<string[]>('take_pending_open').then(handleDroppedPaths)));
    unlisten.push(
      getCurrentWebview().onDragDropEvent((e) => {
        const p = e.payload;
        if (p.type === 'enter' || p.type === 'over') app.dragOver = true;
        else if (p.type === 'leave') app.dragOver = false;
        else if (p.type === 'drop') { app.dragOver = false; handleDroppedPaths(p.paths); }
      }),
    );
    unlisten.push(
      win.onCloseRequested(async (e) => {
        if (!isDirty()) return;
        e.preventDefault();
        if (await confirmDiscard()) await win.destroy();
      }),
    );

    (async () => {
      const pending = await invoke<string[]>('take_pending_open');
      if (pending.length) await handleDroppedPaths(pending);
      else {
        if (session.lastFolder && (await invoke('path_kind', { path: session.lastFolder })) === 'dir') app.root = session.lastFolder;
        if (session.lastFile && (await invoke('path_kind', { path: session.lastFile })) === 'file') await openPath(session.lastFile, { skipConfirm: true });
      }
      requestAnimationFrame(() => win.show());
    })();

    return () => unlisten.forEach((u) => u.then((f) => f()));
  });
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app" class:zen={app.zen} class:mac={isMac} class:no-sidebar={!app.sidebar}>
  {#if !app.zen}
    <header class="topbar chrome" data-tauri-drag-region>
      <button class="tb" class:on={app.sidebar} onclick={() => (app.sidebar = !app.sidebar)} title={`${t('sidebar.toggle')}  ${modKey}\\`}><Icon name="sidebar" /></button>
      <div class="title" data-tauri-drag-region>
        {#if app.docOpen}
          <span class="name" data-tauri-drag-region>{docName()}</span>
          {#if isDirty()}<span class="dirty" title={t('top.unsaved')}>●</span>{/if}
        {/if}
      </div>
      <div class="spacer" data-tauri-drag-region></div>
      {#if app.docOpen}
        <div class="modes" role="tablist">
          {#each MODES as [m, label, tip, icon], i}
            <button class="mode" class:on={app.mode === m} disabled={plain && m === 'visual'} onclick={() => setMode(m)} title="{t(tip)}  {modKey}{i + 1}" role="tab" aria-selected={app.mode === m}>
              <Icon name={icon} size={14} /><span>{t(label)}</span>
            </button>
          {/each}
        </div>
        <button class="tb" onclick={() => saveDoc()} title="{t('top.save')}  {modKey}S" disabled={!isDirty()}><Icon name="save" /></button>
        <button class="tb" onclick={toggleZen} title="{t('top.zen')}  {modKey}⇧↩"><Icon name="zen" /></button>
      {/if}
      <button class="tb" onclick={() => (app.exportOpen = true)} title="{t('top.export')}  {modKey}⇧E"><Icon name="export" /></button>
      <button class="tb" onclick={() => (app.settingsOpen = true)} title="{t('top.settings')}  {modKey},"><Icon name="settings" /></button>
    </header>
  {/if}

  <div class="body">
    {#if app.sidebar && !app.zen}<Sidebar />{/if}
    <main class="main">
      {#if app.docOpen}
        {#if editing && settings.showToolbar && !app.zen}<Toolbar />{/if}
        <div class="content mode-{app.mode}">
          {#if app.mode === 'source'}
            <SourceEditor />
          {:else if app.mode === 'split'}
            <div class="pane"><SourceEditor onScrollLine={(l) => (syncLine = l)} /></div>
            <div class="pane preview-pane"><Preview {syncLine} /></div>
          {:else if app.mode === 'visual'}
            {#await import('$lib/components/VisualEditor.svelte') then { default: VisualEditor }}
              <VisualEditor />
            {/await}
          {:else}
            <Preview />
          {/if}
        </div>
        {#if settings.showStats && (!app.zen || settings.zenShowStats)}<StatusBar />{/if}
      {:else}
        <Welcome />
      {/if}
    </main>
  </div>

  {#if app.zen}
    <div class="zen-exit chrome">
      <button class="tb" onclick={toggleZen} title={t('zen.exit')}><Icon name="x" /></button>
    </div>
    <div class="zen-hint chrome">{t('zen.exit')}</div>
  {/if}

  {#if app.dragOver}
    <div class="drop chrome"><div><Icon name="filetext" size={36} /><p>{t('welcome.drop')}</p></div></div>
  {/if}

  {#if app.toast}<div class="toast chrome" role="status">{app.toast}</div>{/if}
  {#if app.settingsOpen}<Settings />{/if}
  {#if app.exportOpen}<ExportDialog />{/if}
  <PromptDialog />
</div>

<style>
  .app { height: 100vh; display: flex; flex-direction: column; }
  .topbar {
    height: 40px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 8px;
    border-bottom: 1px solid var(--border); background: var(--bg-elev);
  }
  .mac .topbar { padding-left: 80px; height: 42px; }
  .title { display: flex; align-items: center; gap: 6px; min-width: 0; padding-left: 6px; }
  .name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dirty { color: var(--accent); font-size: 9px; }
  .spacer { flex: 1; align-self: stretch; }
  .modes { display: flex; background: var(--bg-active); border-radius: 8px; padding: 2px; margin-right: 6px; }
  .mode {
    display: flex; align-items: center; gap: 5px; border: 0; background: none; color: var(--fg-muted);
    font: 12px var(--font-ui); padding: 3px 10px; border-radius: 6px; cursor: default;
  }
  .mode.on { background: var(--bg); color: var(--fg); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); }
  .mode:disabled { opacity: 0.35; }
  @media (max-width: 860px) { .mode span { display: none; } }
  .tb:disabled { opacity: 0.35; }

  .body { flex: 1; display: flex; min-height: 0; }
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg); }
  .content { flex: 1; min-height: 0; position: relative; }
  .content.mode-split { display: grid; grid-template-columns: 1fr 1fr; }
  .pane { min-width: 0; min-height: 0; overflow: hidden; }
  .preview-pane { border-left: 1px solid var(--border); }
  .preview-pane :global(.preview) { padding-left: 28px; padding-right: 28px; }

  .zen .main { background: var(--bg); }
  .zen-exit { position: fixed; top: 10px; right: 12px; opacity: 0; transition: opacity 0.25s; z-index: 20; }
  .zen-exit:hover { opacity: 1; }
  .zen-hint {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%); font-size: 12px; color: var(--fg-muted);
    background: var(--bg-elev); padding: 6px 12px; border-radius: 20px; animation: hint 3s forwards; pointer-events: none;
  }
  @keyframes hint { 0%, 70% { opacity: 1; } 100% { opacity: 0; } }

  .drop {
    position: fixed; inset: 8px; z-index: 200; border: 2.5px dashed var(--accent); border-radius: 16px;
    background: color-mix(in srgb, var(--accent) 10%, color-mix(in srgb, var(--bg) 85%, transparent));
    display: grid; place-items: center; color: var(--accent); font-size: 15px; font-weight: 600; text-align: center; pointer-events: none;
  }
  .toast {
    position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); z-index: 300; max-width: 80vw;
    background: var(--fg); color: var(--bg); padding: 8px 16px; border-radius: 20px; font-size: 12.5px; box-shadow: var(--shadow);
    animation: rise 0.15s ease-out;
  }
</style>
