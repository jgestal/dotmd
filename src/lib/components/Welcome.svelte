<script lang="ts">
  import Icon from './Icon.svelte';
  import { session } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, dirname, modKey } from '../path';
  import { newDoc, openFileDialog, openFolder, openPath } from '../actions';
</script>

<div class="welcome">
  <div class="card">
    <div class="logo" aria-hidden="true"><span><span class="dot">.</span>md</span></div>
    <h1>{t('welcome.title')}</h1>
    <p class="sub">{t('welcome.subtitle')}</p>
    <div class="actions">
      <button class="big" onclick={openFileDialog}><Icon name="filetext" size={20} /><span>{t('welcome.openFile')}</span><kbd>{modKey}O</kbd></button>
      <button class="big" onclick={() => openFolder()}><Icon name="folder" size={20} /><span>{t('welcome.openFolder')}</span><kbd>{modKey}⇧O</kbd></button>
      <button class="big" onclick={newDoc}><Icon name="plus" size={20} /><span>{t('welcome.new')}</span><kbd>{modKey}N</kbd></button>
    </div>
    {#if session.recent.length}
      <h3>{t('welcome.recent')}</h3>
      <ul class="recent">
        {#each session.recent.slice(0, 8) as p}
          <li><button onclick={() => openPath(p)} title={p}><Icon name="filetext" size={14} /><b>{basename(p)}</b><span>{dirname(p)}</span></button></li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .welcome { height: 100%; display: grid; place-items: center; overflow: auto; padding: 24px; }
  .card { width: min(520px, 100%); text-align: center; }
  .logo {
    width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 16px; display: grid; place-items: center;
    background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #000)); color: var(--accent-fg);
    font: 700 24px var(--font-code); box-shadow: var(--shadow); letter-spacing: -0.02em;
  }
  .logo .dot { opacity: 0.6; }
  h1 { font: 650 22px var(--font-heading); margin: 0 0 6px; }
  .sub { color: var(--fg-muted); margin: 0 0 24px; font-size: 13.5px; }
  .actions { display: grid; gap: 8px; }
  .big {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg-elev); color: var(--fg); font: 14px var(--font-ui); cursor: default; text-align: left;
  }
  .big:hover { border-color: var(--accent); }
  .big span { flex: 1; }
  .big :global(.icon) { color: var(--accent); }
  h3 { margin: 28px 0 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); }
  .recent { list-style: none; margin: 0; padding: 0; text-align: left; }
  .recent button {
    display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; color: var(--fg); padding: 6px 8px;
    border-radius: 7px; font: 13px var(--font-ui); cursor: default; min-width: 0;
  }
  .recent button:hover { background: var(--bg-hover); }
  .recent b { font-weight: 500; white-space: nowrap; }
  .recent span { color: var(--fg-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; flex: 1; }
</style>
