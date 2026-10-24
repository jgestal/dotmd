<script lang="ts">
  import { prompt } from '../prompt.svelte';
  import { t } from '../i18n';

  function focusFirst(node: HTMLElement) {
    requestAnimationFrame(() => node.querySelector('input')?.select());
  }
</script>

{#if prompt.req}
  {@const req = prompt.req}
  <div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && req.resolve(null)}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="dialog"
      use:focusFirst
      onsubmit={(e) => { e.preventDefault(); req.resolve({ ...req.values }); }}
      onkeydown={(e) => e.key === 'Escape' && req.resolve(null)}
    >
      <h3>{req.title}</h3>
      {#each req.fields as f (f.key)}
        <label>
          <span>{f.label}</span>
          <input bind:value={req.values[f.key]} placeholder={f.placeholder} spellcheck="false" autocomplete="off" />
        </label>
      {/each}
      <div class="buttons">
        <button type="button" class="btn" onclick={() => req.resolve(null)}>{t('common.cancel')}</button>
        <button type="submit" class="btn primary">{t('common.ok')}</button>
      </div>
    </form>
  </div>
{/if}

<style>
  .dialog { width: min(420px, calc(100vw - 32px)); padding: 18px; }
  h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
  label { display: grid; gap: 4px; margin-bottom: 10px; font-size: 12px; color: var(--fg-muted); }
  .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
</style>
