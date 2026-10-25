<script lang="ts">
  // Favourite documents, always shown below the workspace folders. Missing ones are struck through
  // with a warning; clicking them offers to locate the file or remove the favourite.
  import { Menu } from '@tauri-apps/api/menu';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import Icon from './Icon.svelte';
  import { app, session } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, dirname, docKind } from '../path';
  import { openPath } from '../actions';
  import { checkMissing, missing, removeFavorite, resolveMissing } from '../workspace.svelte';

  const favorites = $derived(session.favorites ?? []);
  const collapsed = $derived((session.collapsed ?? []).includes('favorites'));

  // Re-check whenever the list or the tree changes (files moved outside DotMD show up as missing).
  $effect(() => {
    favorites.length;
    app.treeVersion;
    void checkMissing();
  });

  function toggle() {
    const list = session.collapsed ?? [];
    session.collapsed = collapsed ? list.filter((p) => p !== 'favorites') : [...list, 'favorites'];
  }

  async function menu(path: string) {
    const m = await Menu.new({
      items: [
        { id: 'open', text: t('ctx.open'), enabled: !missing[path], action: () => void openPath(path) },
        { id: 'reveal', text: t('ctx.reveal'), enabled: !missing[path], action: () => void revealItemInDir(path) },
        { id: 'locate', text: t('fav.locate'), action: () => void resolveMissing(path, false) },
        { item: 'Separator' },
        { id: 'remove', text: t('fav.removeShort'), action: () => removeFavorite(path) },
      ] as any,
    });
    await m.popup();
  }

  const icon = (p: string) => ({ markdown: 'filetext', text: 'filetext', code: 'code', csv: 'table' } as const)[docKind(p)];
</script>

<section class="fav-section" class:collapsed>
  <header>
    <button class="fav-title" onclick={toggle}>
      <span class="chev" class:open={!collapsed}><Icon name="right" size={11} stroke={2.2} /></span>
      <span class="star" aria-hidden="true">★</span> {t('fav.title')}
      {#if favorites.length}<span class="count">{favorites.length}</span>{/if}
    </button>
  </header>
  {#if !collapsed}
    <div class="list">
      {#each favorites as p (p)}
        {@const gone = !!missing[p]}
        <button class="fav" class:gone class:active={app.path === p} title={gone ? `${t('fav.missingTip')}\n${p}` : p}
          onclick={() => (gone ? resolveMissing(p, false) : openPath(p))}
          oncontextmenu={(e) => { e.preventDefault(); menu(p); }}>
          {#if gone}<span class="warn" aria-hidden="true">⚠</span>{:else}<Icon name={icon(p)} size={14} />{/if}
          <span class="name">{basename(p)}</span>
          <span class="dir">{basename(dirname(p))}</span>
        </button>
      {:else}
        <p class="empty">{t('fav.empty')}</p>
      {/each}
    </div>
  {/if}
</section>

<style>
  .fav-section { display: flex; flex-direction: column; flex: 0 1 auto; max-height: 45%; min-height: 0; border-top: 1px solid var(--border); }
  header { padding: 4px 6px 2px 4px; }
  .fav-title {
    display: flex; align-items: center; gap: 4px; width: 100%; border: 0; background: none; padding: 2px 4px; border-radius: 5px;
    color: var(--fg-muted); font: 600 11px var(--font-ui); text-transform: uppercase; letter-spacing: 0.05em; cursor: default;
  }
  .fav-title:hover { background: var(--bg-hover); }
  .star { color: #e5a00d; }
  .count { margin-left: auto; font-weight: 500; }
  .chev { display: inline-flex; transition: transform 0.12s; }
  .chev.open { transform: rotate(90deg); }
  .list { overflow: auto; padding: 0 6px 8px; }
  .fav {
    display: flex; align-items: center; gap: 6px; width: 100%; height: 26px; border: 0; background: none; color: var(--fg);
    font: 13px var(--font-ui); text-align: left; border-radius: 6px; padding: 0 8px 0 22px; cursor: default; white-space: nowrap;
  }
  .fav:hover { background: var(--bg-hover); }
  .fav.active { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .fav :global(.icon) { flex-shrink: 0; color: var(--fg-muted); }
  .name { overflow: hidden; text-overflow: ellipsis; }
  .dir { margin-left: auto; color: var(--fg-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
  .gone .name { text-decoration: line-through; color: var(--fg-muted); }
  .warn { color: #e5a00d; width: 14px; text-align: center; }
  .empty { margin: 4px 12px 8px; color: var(--fg-muted); font-size: 12px; }
</style>
