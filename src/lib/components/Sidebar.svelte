<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import Icon from './Icon.svelte';
  import TreeNode from './TreeNode.svelte';
  import { app, settings } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, isMarkdown } from '../path';
  import { openFolder } from '../actions';
  import { treeContextMenu } from '../treeMenu';

  interface Entry { name: string; path: string; is_dir: boolean }

  let filter = $state('');
  let entries = $state<Entry[]>([]);

  $effect(() => {
    const root = app.root;
    app.treeVersion;
    const all = settings.showAllFiles;
    if (!root) { entries = []; return; }
    invoke<Entry[]>('list_dir', { path: root, all }).then((e) => (entries = e)).catch(() => (entries = []));
  });

  const visible = (c: Entry) => !filter || c.is_dir || c.name.toLowerCase().includes(filter.toLowerCase());

  interface Heading { level: number; text: string; line: number }
  const headings = $derived.by(() => {
    if (app.path && !isMarkdown(app.path)) return [];
    const out: Heading[] = [];
    let fence = false;
    const lines = app.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*(```|~~~)/.test(l)) fence = !fence;
      if (fence) continue;
      const m = l.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`~]/g, ''), line: i + 1 });
    }
    return out;
  });
  const minLevel = $derived(Math.min(...headings.map((h) => h.level), 6));

  // Resizable sidebar: drag the edge.
  function startResize(e: PointerEvent) {
    const startX = e.clientX, startW = settings.sidebarWidth;
    const sign = settings.sidebarSide === 'left' ? 1 : -1;
    const move = (ev: PointerEvent) => (settings.sidebarWidth = Math.max(180, Math.min(520, startW + sign * (ev.clientX - startX))));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('resizing'); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add('resizing');
  }
</script>

<aside class="sidebar" class:right={settings.sidebarSide === 'right'} style="width:{settings.sidebarWidth}px">
  <div class="tabs">
    <button class="tab" class:on={app.sidebarTab === 'files'} onclick={() => (app.sidebarTab = 'files')}><Icon name="folder" size={14} /> {t('sidebar.files')}</button>
    <button class="tab" class:on={app.sidebarTab === 'outline'} onclick={() => (app.sidebarTab = 'outline')}><Icon name="outline" size={14} /> {t('sidebar.outline')}</button>
  </div>

  {#if app.sidebarTab === 'files'}
    {#if app.root}
      <div class="root-row">
        <button class="root-name" title={app.root} oncontextmenu={(e) => { e.preventDefault(); treeContextMenu({ name: basename(app.root!), path: app.root!, is_dir: true }); }}>
          {basename(app.root)}
        </button>
        <button class="tb small" title={t('sidebar.allFiles')} class:on={settings.showAllFiles} onclick={() => (settings.showAllFiles = !settings.showAllFiles)}><Icon name="file" size={14} /></button>
        <button class="tb small" title={t('sidebar.refresh')} onclick={() => app.treeVersion++}><Icon name="refresh" size={14} /></button>
      </div>
      <input class="filter" placeholder={t('sidebar.filter')} bind:value={filter} spellcheck="false" />
      <div class="tree">
        {#each entries.filter(visible) as e (e.path)}
          <TreeNode entry={e} {filter} />
        {/each}
      </div>
    {:else}
      <div class="empty">
        <p>{t('sidebar.noFolder')}</p>
        <button class="btn" onclick={() => openFolder()}>{t('welcome.openFolder')}</button>
      </div>
    {/if}
  {:else}
    <nav class="outline">
      {#each headings as h}
        <button class="outline-item" style="padding-left:{8 + (h.level - minLevel) * 14}px" class:h1={h.level === minLevel}
          onclick={() => (app.reveal = { line: h.line, n: app.reveal.n + 1 })}>{h.text}</button>
      {:else}
        <p class="empty">{t('sidebar.noHeadings')}</p>
      {/each}
    </nav>
  {/if}
  <div class="resizer" role="separator" onpointerdown={startResize}></div>
</aside>

<style>
  .sidebar {
    position: relative; flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--bg-elev); border-right: 1px solid var(--border); min-height: 0;
  }
  .sidebar.right { border-right: 0; border-left: 1px solid var(--border); order: 2; }
  .tabs { display: flex; gap: 2px; padding: 8px 8px 4px; }
  .tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; height: 26px; border: 0;
    border-radius: 6px; background: none; color: var(--fg-muted); font: 12px var(--font-ui); cursor: default;
  }
  .tab.on { background: var(--bg-active); color: var(--fg); }
  .root-row { display: flex; align-items: center; gap: 2px; padding: 6px 8px 2px 12px; }
  .root-name {
    flex: 1; min-width: 0; text-align: left; border: 0; background: none; color: var(--fg-muted); padding: 0;
    font: 600 11px var(--font-ui); text-transform: uppercase; letter-spacing: 0.05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default;
  }
  .filter { margin: 4px 8px 6px; height: 26px; font-size: 12px; }
  .tree, .outline { flex: 1; overflow: auto; padding: 0 6px 12px; min-height: 0; }
  .outline { padding-top: 4px; }
  .outline-item {
    display: block; width: 100%; text-align: left; border: 0; background: none; color: var(--fg-muted);
    font: 13px var(--font-ui); padding: 4px 8px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default;
  }
  .outline-item.h1 { color: var(--fg); font-weight: 600; }
  .outline-item:hover { background: var(--bg-hover); color: var(--fg); }
  .empty { padding: 24px 14px; color: var(--fg-muted); font-size: 13px; text-align: center; }
  .resizer { position: absolute; top: 0; bottom: 0; right: -3px; width: 6px; cursor: col-resize; z-index: 5; }
  .sidebar.right .resizer { right: auto; left: -3px; }
  .tb.small { width: 24px; height: 24px; }
</style>
