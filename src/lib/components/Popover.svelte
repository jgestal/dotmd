<script lang="ts">
  import type { Snippet } from 'svelte';

  let { trigger, children, open = $bindable(false), align = 'left' }: {
    trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
    children: Snippet<[{ close: () => void }]>;
    open?: boolean;
    align?: 'left' | 'right';
  } = $props();

  let root: HTMLElement;
  const close = () => (open = false);
  const toggle = () => (open = !open);

  function onDoc(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
  function onKey(e: KeyboardEvent) {
    if (open && e.key === 'Escape') { e.stopPropagation(); open = false; }
  }
</script>

<svelte:window onmousedown={onDoc} onkeydown={onKey} />

<div class="popover-root" bind:this={root}>
  {@render trigger({ toggle, open })}
  {#if open}
    <div class="popover" class:right={align === 'right'} role="menu">
      {@render children({ close })}
    </div>
  {/if}
</div>

<style>
  .popover-root { position: relative; display: inline-flex; }
  .popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 50;
    min-width: 180px;
    background: var(--bg-elev);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 5px;
    animation: pop 0.12s ease-out;
  }
  .popover.right { left: auto; right: 0; }
  @keyframes pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
</style>
