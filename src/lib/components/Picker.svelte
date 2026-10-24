<script lang="ts" generics="T">
  // Keyboard-driven list picker used by the command palette and quick open.
  import { tick } from 'svelte';

  interface Item { item: T; html: string; detail?: string; hint?: string; disabled?: boolean }

  let { placeholder, items, onpick, onclose, query = $bindable('') }: {
    placeholder: string;
    items: (query: string) => Item[] | Promise<Item[]>;
    onpick: (item: T) => void;
    onclose: () => void;
    query?: string;
  } = $props();

  let list = $state<Item[]>([]);
  let active = $state(0);
  let listEl: HTMLElement;
  let seq = 0;

  $effect(() => {
    const q = query;
    const my = ++seq;
    Promise.resolve(items(q)).then((r) => {
      if (my !== seq) return;
      list = r;
      active = 0;
    });
  });

  async function move(d: number) {
    if (!list.length) return;
    active = (active + d + list.length) % list.length;
    await tick();
    listEl?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }

  function pick(i: number) {
    const it = list[i];
    if (!it || it.disabled) return;
    onclose();
    onpick(it.item);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onclose(); }
  }

  function autofocus(node: HTMLInputElement) {
    requestAnimationFrame(() => node.focus());
  }
</script>

<div class="backdrop top" role="presentation" onmousedown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="dialog picker" role="dialog">
    <input use:autofocus bind:value={query} {placeholder} onkeydown={onKey} spellcheck="false" autocomplete="off" />
    <div class="list" bind:this={listEl} role="listbox">
      {#each list as it, i}
        <button
          class="row"
          class:on={i === active}
          class:disabled={it.disabled}
          role="option"
          aria-selected={i === active}
          onmousemove={() => (active = i)}
          onclick={() => pick(i)}
        >
          <span class="main">
            <span class="label">{@html it.html}</span>
            {#if it.detail}<span class="detail">{it.detail}</span>{/if}
          </span>
          {#if it.hint}<kbd>{it.hint}</kbd>{/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop.top { place-items: start center; padding-top: 12vh; background: rgba(0, 0, 0, 0.18); }
  .picker { width: min(620px, calc(100vw - 32px)); overflow: hidden; padding: 0; }
  input { width: 100%; border: 0 !important; border-bottom: 1px solid var(--border) !important; border-radius: 0 !important; padding: 14px 16px !important; font-size: 15px !important; background: transparent !important; outline: none; }
  .list { max-height: 50vh; overflow-y: auto; padding: 6px; }
  .row { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; color: var(--fg); text-align: left; padding: 7px 10px; border-radius: 7px; font: 13px var(--font-ui); cursor: default; }
  .row.on { background: var(--accent); color: var(--accent-fg); }
  .row.disabled { opacity: 0.45; }
  .main { flex: 1; min-width: 0; display: flex; gap: 8px; align-items: baseline; }
  .label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .detail { color: var(--fg-muted); font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; flex: 1; }
  .row.on .detail, .row.on kbd { color: inherit; opacity: 0.8; }
  .label :global(mark) { background: none; color: inherit; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
</style>
