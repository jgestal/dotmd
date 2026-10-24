<script lang="ts">
  import Icon from './Icon.svelte';
  import { session } from '../state.svelte';
  import { t } from '../i18n';
  import { basename, dirname, modKey } from '../path';
  import { newDoc, openFileDialog, openFolder, openPath } from '../actions';
</script>

<div class="welcome">
  <div class="card">
    <img class="logo" src="/favicon.png" alt="" width="88" height="88" />
    <h1>DotMD</h1>
    <p class="tagline">Markdown Viewer &amp; Editor</p>
    <p class="sub">{t('welcome.title')}. {t('welcome.subtitle')}</p>
    <div class="actions">
      <button class="big" onclick={openFileDialog}><Icon name="filetext" size={20} /><span>{t('welcome.openFile')}</span><kbd>{modKey}O</kbd></button>
      <button class="big" onclick={() => openFolder()}><Icon name="folder" size={20} /><span>{t('welcome.openFolder')}</span><kbd>{modKey}⇧O</kbd></button>
      <button class="big" onclick={newDoc}><Icon name="plus" size={20} /><span>{t('welcome.new')}</span><kbd>{modKey}N</kbd></button>
    </div>
    <div class="tips">
      <span><kbd>{modKey}P</kbd> {t('cmd.quickOpen')}</span>
      <span><kbd>{modKey}⇧P</kbd> {t('cmd.palette')}</span>
      <span><kbd>{modKey}⌥F</kbd> {t('cmd.focusWriting')}</span>
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
  .logo { display: block; width: 88px; height: 88px; margin: 0 auto 10px; filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.18)); }
  h1 { font: 700 28px var(--font-heading); margin: 0; letter-spacing: -0.02em; }
  .tagline { margin: 2px 0 10px; color: var(--accent); font: 600 12px var(--font-ui); letter-spacing: 0.08em; text-transform: uppercase; }
  .tips { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 16px; margin-top: 16px; color: var(--fg-muted); font-size: 12px; }
  .tips kbd { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; margin-right: 3px; }
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
