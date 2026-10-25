<script lang="ts">
  // Help ▸ Keyboard Shortcuts: every command with a shortcut, grouped like the menus. Built from
  // the command registry, so it can never drift from what the keys really do.
  import Icon from './Icon.svelte';
  import { app } from '../state.svelte';
  import { t, type Key } from '../i18n';
  import { allCommands, formatShortcut, type Command, type MenuId } from '../commands';

  let query = $state('');
  const GROUPS: [MenuId | 'other', Key][] = [['file', 'menu.file'], ['edit', 'menu.edit'], ['format', 'menu.format'], ['view', 'menu.view'], ['go', 'menu.go'], ['help', 'menu.help'], ['other', 'menu.other']];
  const withKeys = allCommands().filter((c) => c.shortcut && !c.id.startsWith('theme.') && !c.id.endsWith('Alt'));
  const label = (c: Command) => c.label();
  const groups = $derived(
    GROUPS.map(([g, k]) => [k, withKeys.filter((c) => (c.menu ?? 'other') === g && (!query || label(c).toLowerCase().includes(query.toLowerCase())))] as const).filter(([, list]) => list.length),
  );
  const close = () => (app.shortcutsOpen = false);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && close()}>
  <div class="dialog shortcuts" role="dialog" aria-label={t('cmd.shortcuts')}>
    <header>
      <h2>{t('cmd.shortcuts')}</h2>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="search" placeholder={t('search.placeholder')} bind:value={query} autofocus spellcheck="false" />
      <button class="tb" onclick={close} title={t('common.close')}><Icon name="x" /></button>
    </header>
    <div class="cols">
      {#each groups as [k, list]}
        <section>
          <h3>{t(k)}</h3>
          {#each list as c (c.id)}
            <div class="row"><span>{label(c)}</span><kbd>{formatShortcut(c.shortcut)}</kbd></div>
          {/each}
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .shortcuts { width: min(900px, calc(100vw - 40px)); max-height: calc(100vh - 60px); display: flex; flex-direction: column; padding: 0; font-size: 13px; }
  header { display: flex; align-items: center; gap: 12px; padding: 14px 18px 10px; border-bottom: 1px solid var(--border); }
  h2 { font-size: 15px; margin: 0; flex: 1; }
  .search { width: 220px; }
  .cols { columns: 2 320px; column-gap: 28px; padding: 12px 18px 18px; overflow: auto; }
  section { break-inside: avoid; margin-bottom: 14px; }
  h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 0 0 6px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent); }
  kbd { font: 12px var(--font-ui); color: var(--fg-muted); white-space: nowrap; }
</style>
