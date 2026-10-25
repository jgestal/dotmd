<script lang="ts">
  import { services } from '../container';
  import Icon from './Icon.svelte';
  import Self from './TreeNode.svelte';
  import { app, session, settings } from '../state.svelte';
  import { insertFileLink, movePath, openPath } from '../actions';
  import { pointerDrag } from '../drag';
  import { docKind, isTextPath } from '../path';

  const fileIcon = (p: string) =>
    !isTextPath(p) ? 'file' : ({ markdown: 'filetext', text: 'filetext', code: 'code', csv: 'table' } as const)[docKind(p)];
  import { treeContextMenu } from '../treeMenu';

  interface Entry { name: string; path: string; is_dir: boolean }

  let { entry, depth = 0, filter = '' }: { entry: Entry; depth?: number; filter?: string } = $props();

  let children = $state<Entry[] | null>(null);
  const expanded = $derived(session.expanded.includes(entry.path) || (!!filter && entry.is_dir));

  async function load() {
    try {
      children = await services.fs.listDir(entry.path, settings.showAllFiles);
    } catch {
      children = [];
    }
  }

  $effect(() => {
    app.treeVersion;
    settings.showAllFiles;
    if (expanded) load();
  });

  function toggle() {
    if (!entry.is_dir) return void openPath(entry.path);
    session.expanded = expanded ? session.expanded.filter((p) => p !== entry.path) : [...session.expanded, entry.path];
  }

  function onKey(e: KeyboardEvent) {
    const el = e.currentTarget as HTMLElement;
    const all = [...document.querySelectorAll<HTMLElement>('.tree-row')];
    const i = all.indexOf(el);
    if (e.key === 'ArrowDown') { all[i + 1]?.focus(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { all[i - 1]?.focus(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' && entry.is_dir && !expanded) toggle();
    else if (e.key === 'ArrowLeft' && entry.is_dir && expanded) toggle();
    else if (e.key === 'Enter' || e.key === ' ') { toggle(); e.preventDefault(); }
  }

  const visible = (c: Entry) => !filter || c.is_dir || c.name.toLowerCase().includes(filter.toLowerCase());
</script>

<button
  class="tree-row"
  class:active={app.path === entry.path}
  style="padding-left: {10 + depth * 14}px"
  onclick={toggle}
  onkeydown={onKey}
  oncontextmenu={(e) => { e.preventDefault(); treeContextMenu(entry); }}
  onpointerdown={(e) => pointerDrag(e, {
    label: entry.name,
    target: '.tree-row[data-dir], .ws-title, .cm-content, .milkdown .ProseMirror',
    // Onto a folder: move. Into the editor: insert a link (or the image) to this file.
    onDrop: (el) => (el.dataset.path ? movePath(entry.path, el.dataset.path) : !entry.is_dir && insertFileLink(entry.path)),
    // Out of the window: a real file drag (copy to Finder/Explorer, attach to an e-mail…).
    onOut: () => void services.window.dragOut([entry.path]).catch(() => {}),
  })}
  data-dir={entry.is_dir ? '' : undefined}
  data-path={entry.path}
  title={entry.path}
>
  {#if entry.is_dir}
    <span class="chev" class:open={expanded}><Icon name="right" size={12} stroke={2.2} /></span>
    <Icon name="folder" size={15} />
  {:else}
    <span class="chev"></span>
    <Icon name={fileIcon(entry.path)} size={15} />
  {/if}
  <span class="name">{entry.name}</span>
</button>

{#if entry.is_dir && expanded && children}
  {#each children.filter(visible) as c (c.path)}
    <Self entry={c} depth={depth + 1} {filter} />
  {/each}
{/if}

<style>
  .tree-row {
    display: flex; align-items: center; gap: 5px; width: 100%; height: 26px;
    border: 0; background: none; color: var(--fg); font: 13px var(--font-ui); text-align: left;
    border-radius: 6px; padding-right: 8px; cursor: default; white-space: nowrap;
  }
  .tree-row:hover { background: var(--bg-hover); }
  .tree-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .tree-row.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--fg); }
  .tree-row :global(.icon) { flex-shrink: 0; color: var(--fg-muted); }
  .tree-row.active :global(.icon) { color: var(--accent); }
  .chev { width: 12px; display: inline-flex; transition: transform 0.12s; color: var(--fg-muted); }
  .chev.open { transform: rotate(90deg); }
  .name { overflow: hidden; text-overflow: ellipsis; }
</style>
