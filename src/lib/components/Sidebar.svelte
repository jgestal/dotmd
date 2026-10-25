<script lang="ts">
  import Icon from './Icon.svelte';
  import FolderSection from './FolderSection.svelte';
  import FavoritesSection from './FavoritesSection.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import { app, session, settings } from '../state.svelte';
  import { workspaceFolders } from '../workspace.svelte';
  import { t } from '../i18n';
  import { isMarkdown } from '../path';
  import { openFolder } from '../actions';

  let filter = $state('');
  let sectionsEl = $state<HTMLElement>();

  /** Drag the bar between two folders to share the height between them. */
  function startSplit(e: PointerEvent, i: number) {
    const slots = [...sectionsEl!.querySelectorAll<HTMLElement>(':scope > .slot')];
    const [a, b] = [slots[i - 1], slots[i]];
    const folders = workspaceFolders();
    const [ka, kb] = [folders[i - 1], folders[i]];
    const ha = a.getBoundingClientRect().height, hb = b.getBoundingClientRect().height;
    const total = (session.sectionGrow?.[ka] ?? 1) + (session.sectionGrow?.[kb] ?? 1);
    const y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      const da = Math.max(40, Math.min(ha + hb - 40, ha + ev.clientY - y0));
      session.sectionGrow = { ...(session.sectionGrow ?? {}), [ka]: (total * da) / (ha + hb), [kb]: (total * (ha + hb - da)) / (ha + hb) };
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('resizing-v'); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.classList.add('resizing-v');
    e.preventDefault();
  }

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
  /** The heading of the section being read or edited. */
  const activeHeading = $derived(headings.findLastIndex((h) => h.line <= app.viewLine));
  let outlineEl = $state<HTMLElement>();
  $effect(() => {
    activeHeading;
    outlineEl?.querySelector('.outline-item.active')?.scrollIntoView({ block: 'nearest' });
  });

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
    <button class="tab" class:on={app.sidebarTab === 'search'} onclick={() => { app.sidebarTab = 'search'; app.searchFocus++; }} title={t('sidebar.search')}><Icon name="search" size={14} /></button>
  </div>

  {#if app.sidebarTab === 'files'}
    <div class="files-bar">
      <input class="filter" placeholder={t('sidebar.filter')} bind:value={filter} spellcheck="false" />
      <button class="tb small" title={t('sidebar.allFiles')} class:on={settings.showAllFiles} onclick={() => (settings.showAllFiles = !settings.showAllFiles)}><Icon name="file" size={14} /></button>
      <button class="tb small" title={t('ws.add')} onclick={() => openFolder()}><Icon name="plus" size={14} /></button>
    </div>
    <div class="sections" bind:this={sectionsEl}>
      {#each workspaceFolders() as root, i (root)}
        {#if i > 0}<div class="splitter" role="separator" aria-orientation="horizontal" onpointerdown={(e) => startSplit(e, i)}></div>{/if}
        <div class="slot" class:sized={session.sectionGrow?.[root] != null} style:flex-grow={session.sectionGrow?.[root]}><FolderSection {root} {filter} /></div>
      {:else}
        <div class="empty">
          <p>{t('sidebar.noFolder')}</p>
          <button class="btn" onclick={() => openFolder()}>{t('welcome.openFolder')}</button>
        </div>
      {/each}
      <!-- Right below the folders, not pinned to the bottom of the sidebar. -->
      <FavoritesSection />
      <div class="rest"></div>
    </div>
  {:else if app.sidebarTab === 'search'}
    <SearchPanel />
  {:else}
    <nav class="outline" bind:this={outlineEl}>
      {#each headings as h, i}
        <button class="outline-item" style="padding-left:{8 + (h.level - minLevel) * 14}px" class:h1={h.level === minLevel} class:active={i === activeHeading}
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
  .tab:last-child { flex: 0 0 30px; }
  .files-bar { display: flex; align-items: center; gap: 2px; padding: 4px 8px 4px; }
  .filter { flex: 1; min-width: 0; height: 26px; font-size: 12px; }
  .sections { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  /* Folders take the height they need (scrolling when long); dragged bars give them fixed shares. */
  .slot { flex: 0 1 auto; display: flex; flex-direction: column; min-height: 0; }
  .slot.sized { flex-basis: 0; }
  .slot > :global(.ws-section) { flex: 1 1 auto; }
  .rest { flex: 1 1 0; min-height: 0; }
  .splitter { height: 5px; margin: -2px 0; cursor: row-resize; position: relative; z-index: 2; flex-shrink: 0; }
  .splitter::after { content: ''; position: absolute; left: 8px; right: 8px; top: 2px; height: 1px; background: var(--border); }
  .splitter:hover::after { background: var(--accent); height: 2px; }
  :global(body.resizing-v), :global(body.resizing-v *) { cursor: row-resize !important; user-select: none; }
  .outline { flex: 1; overflow: auto; padding: 0 6px 12px; min-height: 0; }
  .outline { padding-top: 4px; }
  .outline-item {
    display: block; width: 100%; text-align: left; border: 0; background: none; color: var(--fg-muted);
    font: 13px var(--font-ui); padding: 4px 8px; border-radius: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: default;
  }
  .outline-item.h1 { color: var(--fg); font-weight: 600; }
  .outline-item.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .outline-item:hover { background: var(--bg-hover); color: var(--fg); }
  .empty { padding: 24px 14px; color: var(--fg-muted); font-size: 13px; text-align: center; }
  .resizer { position: absolute; top: 0; bottom: 0; right: -3px; width: 6px; cursor: col-resize; z-index: 5; }
  .sidebar.right .resizer { right: auto; left: -3px; }
  .tb.small { width: 24px; height: 24px; }
</style>
