<script lang="ts">
  // One workspace folder in the sidebar: collapsible header with actions, and its file tree.
  import { services } from '../container';
  import Icon from './Icon.svelte';
  import TreeNode from './TreeNode.svelte';
  import { app, session, settings } from '../state.svelte';
  import { t } from '../i18n';
  import { basename } from '../path';
  import { treeContextMenu } from '../treeMenu';
  import { missing, removeFolder, resolveMissing } from '../workspace.svelte';

  interface Entry { name: string; path: string; is_dir: boolean }
  let { root, filter = '' }: { root: string; filter?: string } = $props();

  let entries = $state<Entry[]>([]);
  const collapsed = $derived((session.collapsed ?? []).includes(root));
  const gone = $derived(!!missing[root]);

  $effect(() => {
    app.treeVersion;
    const all = settings.showAllFiles;
    if (collapsed || gone) return;
    services.fs.listDir(root, all)
      .then((e) => (entries = e))
      .catch(() => { entries = []; missing[root] = true; });
  });

  const visible = (c: Entry) => !filter || c.is_dir || c.name.toLowerCase().includes(filter.toLowerCase());

  function toggle() {
    const list = session.collapsed ?? [];
    session.collapsed = collapsed ? list.filter((p) => p !== root) : [...list, root];
  }
</script>

<section class="ws-section" class:active={app.root === root} class:collapsed>
  <header class="ws-head" class:gone>
    <button class="ws-title" onclick={() => (gone ? resolveMissing(root, true) : toggle())} title={gone ? t('fav.missingTip') : root} data-path={root}
      oncontextmenu={(e) => { e.preventDefault(); if (!gone) treeContextMenu({ name: basename(root), path: root, is_dir: true }); }}>
      <span class="chev" class:open={!collapsed}><Icon name="right" size={11} stroke={2.2} /></span>
      {#if gone}<span class="warn" aria-hidden="true">⚠</span>{/if}
      <span class="label">{basename(root)}</span>
    </button>
    {#if !gone}
      <button class="tb small" title={t('sidebar.refresh')} onclick={() => app.treeVersion++}><Icon name="refresh" size={13} /></button>
    {/if}
    <button class="tb small" title={t('ws.close')} onclick={() => removeFolder(root)}><Icon name="x" size={13} /></button>
  </header>
  {#if !collapsed && !gone}
    <div class="tree" role="tree">
      {#each entries.filter(visible) as e (e.path)}
        <TreeNode entry={e} {filter} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .ws-section { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
  .ws-section.collapsed { flex: 0 0 auto; }
  .ws-head { display: flex; align-items: center; gap: 1px; padding: 4px 6px 2px 4px; }
  .ws-title {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; border: 0; background: none; padding: 2px 4px;
    color: var(--fg-muted); font: 600 11px var(--font-ui); text-transform: uppercase; letter-spacing: 0.05em; cursor: default; border-radius: 5px;
  }
  .ws-title:hover { background: var(--bg-hover); }
  .ws-section.active .ws-title { color: var(--fg); }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gone .label { text-decoration: line-through; opacity: 0.7; }
  .warn { color: #e5a00d; }
  .chev { display: inline-flex; transition: transform 0.12s; }
  .chev.open { transform: rotate(90deg); }
  .tree { flex: 1; overflow: auto; padding: 0 6px 8px; min-height: 0; }
  .tb.small { width: 22px; height: 22px; opacity: 0; }
  .ws-head:hover .tb.small, .gone .tb.small { opacity: 1; }
</style>
