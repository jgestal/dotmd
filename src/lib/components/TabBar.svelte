<script lang="ts">
  import { Menu } from '@tauri-apps/api/menu';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import Icon from './Icon.svelte';
  import { app } from '../state.svelte';
  import { t } from '../i18n';
  import { activateTab, closeTab, docName, moveTab, newDoc } from '../actions';

  let dragFrom = -1;
  let dropAt = $state(-1);

  const dirty = (i: number) =>
    i === app.activeTab ? app.content !== app.saved : app.tabs[i].content !== app.tabs[i].saved;

  async function contextMenu(i: number) {
    const tab = app.tabs[i];
    const menu = await Menu.new({
      items: [
        { id: 'close', text: t('tabs.close'), action: () => void closeTab(i) },
        {
          id: 'others', text: t('tabs.closeOthers'),
          action: async () => {
            const keep = app.tabs[i].id;
            for (let j = app.tabs.length - 1; j >= 0; j--) if (app.tabs[j]?.id !== keep && !(await closeTab(j))) return;
          },
        },
        ...(tab.path ? [{ id: 'reveal', text: t('ctx.reveal'), action: () => void revealItemInDir(tab.path!) }] : []),
      ],
    });
    await menu.popup();
  }
</script>

<div class="tabbar" role="tablist" tabindex="-1" ondblclick={(e) => e.target === e.currentTarget && newDoc()}>
  {#each app.tabs as tab, i (tab.id)}
    <div
      class="tab"
      class:on={i === app.activeTab}
      class:drop-before={dropAt === i}
      role="tab"
      tabindex="0"
      aria-selected={i === app.activeTab}
      draggable="true"
      title={tab.path ?? t('top.untitled')}
      onclick={() => activateTab(i)}
      onkeydown={(e) => e.key === 'Enter' && activateTab(i)}
      onauxclick={(e) => e.button === 1 && closeTab(i)}
      oncontextmenu={(e) => { e.preventDefault(); contextMenu(i); }}
      ondragstart={(e) => { dragFrom = i; e.dataTransfer?.setData('text/plain', String(i)); }}
      ondragover={(e) => { e.preventDefault(); dropAt = i; }}
      ondragleave={() => (dropAt = -1)}
      ondrop={(e) => { e.preventDefault(); moveTab(dragFrom, i); dropAt = -1; }}
      ondragend={() => (dropAt = -1)}
    >
      <span class="name">{docName(i === app.activeTab ? app.path : tab.path)}</span>
      <button class="close" class:dirty={dirty(i)} onclick={(e) => { e.stopPropagation(); closeTab(i); }} aria-label={t('tabs.close')}>
        <span class="dot">●</span><Icon name="x" size={12} stroke={2} />
      </button>
    </div>
  {/each}
  <button class="tb add" onclick={newDoc} title={t('cmd.new')}><Icon name="plus" size={14} /></button>
</div>

<style>
  .tabbar {
    display: flex; align-items: stretch; gap: 1px; height: 32px; padding: 0 6px; flex-shrink: 0;
    background: var(--bg-elev); border-bottom: 1px solid var(--border); overflow-x: auto; scrollbar-width: none;
  }
  .tab {
    position: relative; display: flex; align-items: center; gap: 6px; min-width: 90px; max-width: 220px; padding: 0 6px 0 12px;
    color: var(--fg-muted); font-size: 12px; cursor: default; border-radius: 7px 7px 0 0; margin-top: 4px;
  }
  .tab:hover { background: var(--bg-hover); }
  .tab.on { background: var(--bg); color: var(--fg); box-shadow: 0 -1px 0 var(--border), 1px 0 0 var(--border), -1px 0 0 var(--border); }
  .tab.drop-before::before { content: ''; position: absolute; left: -1px; top: 4px; bottom: 4px; width: 2px; background: var(--accent); }
  .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .close { width: 18px; height: 18px; display: grid; place-items: center; border: 0; border-radius: 4px; background: none; color: inherit; padding: 0; opacity: 0; }
  .close > :global(*) { grid-area: 1 / 1; }
  .close .dot { font-size: 8px; color: var(--accent); opacity: 0; }
  .tab:hover .close, .tab.on .close { opacity: 1; }
  .close.dirty { opacity: 1; }
  .close.dirty .dot { opacity: 1; }
  .close.dirty :global(.icon) { opacity: 0; }
  .close:hover { background: var(--bg-active); }
  .close.dirty:hover .dot { opacity: 0; }
  .close.dirty:hover :global(.icon) { opacity: 1; }
  .add { align-self: center; width: 24px; height: 24px; margin-left: 2px; }
</style>
