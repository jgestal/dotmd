<script lang="ts">
  import Icon from './Icon.svelte';
  import Popover from './Popover.svelte';
  import { t, type Key } from '../i18n';
  import { getEditorApi } from '../state.svelte';
  import { insertLink as link, insertImage as image, updateToc } from '../actions';
  import { ALERT_KINDS, CODE_LANGS, MERMAID_TEMPLATES, type FormatAction } from '../snippets';
  import { modKey } from '../path';

  const exec = (a: FormatAction) => getEditorApi()?.exec(a);

  let gridR = $state(0), gridC = $state(0);
  const GRID_R = 8, GRID_C = 10;

  type Btn = { icon: string; label: Key; key?: string; run: () => void };
  const inline: Btn[] = [
    { icon: 'bold', label: 'tb.bold', key: 'B', run: () => exec({ type: 'bold' }) },
    { icon: 'italic', label: 'tb.italic', key: 'I', run: () => exec({ type: 'italic' }) },
    { icon: 'strike', label: 'tb.strike', key: '⇧X', run: () => exec({ type: 'strike' }) },
    { icon: 'highlight', label: 'tb.highlight', key: '⇧H', run: () => exec({ type: 'highlight' }) },
    { icon: 'code', label: 'tb.code', key: '⇧C', run: () => exec({ type: 'code' }) },
  ];
  const blocks: Btn[] = [
    { icon: 'quote', label: 'tb.quote', run: () => exec({ type: 'quote' }) },
    { icon: 'ul', label: 'tb.ul', run: () => exec({ type: 'ul' }) },
    { icon: 'ol', label: 'tb.ol', run: () => exec({ type: 'ol' }) },
    { icon: 'task', label: 'tb.task', run: () => exec({ type: 'task' }) },
  ];
  const tip = (b: Btn) => t(b.label) + (b.key ? `  ${modKey}${b.key}` : '');
</script>

<div class="toolbar" role="toolbar">
  <div class="group">
    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb wide" class:on={open} onclick={toggle} title={t('tb.heading')}><Icon name="heading" /><Icon name="down" size={12} /></button>
      {/snippet}
      {#snippet children({ close })}
        <button class="menu-item" onclick={() => { exec({ type: 'paragraph' }); close(); }}><Icon name="paragraph" /> {t('tb.paragraph')}</button>
        {#each [1, 2, 3, 4, 5, 6] as level}
          <button class="menu-item" onclick={() => { exec({ type: 'heading', level }); close(); }}>
            <span class="h-sample" style="font-size:{1.35 - level * 0.08}em">H{level}</span> {t('tb.heading')} {level}
            <kbd>{modKey}⌥{level}</kbd>
          </button>
        {/each}
      {/snippet}
    </Popover>
  </div>

  <div class="group">
    {#each inline as b}
      <button class="tb" onclick={b.run} title={tip(b)}><Icon name={b.icon} /></button>
    {/each}
  </div>

  <div class="group">
    {#each blocks as b}
      <button class="tb" onclick={b.run} title={tip(b)}><Icon name={b.icon} /></button>
    {/each}
  </div>

  <div class="group">
    <button class="tb" onclick={link} title="{t('tb.link')}  {modKey}K"><Icon name="link" /></button>
    <button class="tb" onclick={image} title={t('tb.image')}><Icon name="image" /></button>

    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb" class:on={open} onclick={toggle} title={t('tb.table')}><Icon name="table" /></button>
      {/snippet}
      {#snippet children({ close })}
        <div class="grid-picker" role="grid" tabindex="-1" onmouseleave={() => { gridR = 0; gridC = 0; }}>
          {#each Array(GRID_R) as _, r}
            <div class="grid-row">
              {#each Array(GRID_C) as _, c}
                <button
                  class="cell"
                  class:hot={r < gridR && c < gridC}
                  aria-label="{r + 1}×{c + 1}"
                  onmouseenter={() => { gridR = r + 1; gridC = c + 1; }}
                  onclick={() => { exec({ type: 'table', rows: r + 1, cols: c + 1 }); close(); }}
                ></button>
              {/each}
            </div>
          {/each}
          <div class="grid-label">{gridR ? `${gridC} × ${gridR}` : t('tb.table')}</div>
        </div>
        <button class="menu-item" onclick={() => { exec({ type: 'formatTable' }); close(); }}><Icon name="columns" /> {t('tb.tableFormat')} <kbd>{modKey}⇧T</kbd></button>
      {/snippet}
    </Popover>

    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb" class:on={open} onclick={toggle} title={t('tb.codeblock')}><Icon name="codeblock" /></button>
      {/snippet}
      {#snippet children({ close })}
        <div class="lang-grid">
          {#each CODE_LANGS as lang}
            <button class="chip" onclick={() => { exec({ type: 'codeblock', lang }); close(); }}>{lang || t('tb.plain')}</button>
          {/each}
        </div>
      {/snippet}
    </Popover>

    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb" class:on={open} onclick={toggle} title={t('tb.mermaid')}><Icon name="mermaid" /></button>
      {/snippet}
      {#snippet children({ close })}
        {#each Object.keys(MERMAID_TEMPLATES) as tpl}
          <button class="menu-item" onclick={() => { exec({ type: 'mermaid', template: tpl }); close(); }}>{tpl}</button>
        {/each}
      {/snippet}
    </Popover>

    <button class="tb" onclick={() => exec({ type: 'math' })} title={t('tb.math')}><Icon name="math" /></button>
    <button class="tb" onclick={updateToc} title="{t('tb.toc')}  {modKey}⌥T"><Icon name="outline" /></button>
  </div>

  <div class="group">
    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb" class:on={open} onclick={toggle} title={t('tb.alert')}><Icon name="alert" /></button>
      {/snippet}
      {#snippet children({ close })}
        {#each ALERT_KINDS as kind}
          <button class="menu-item" onclick={() => { exec({ type: 'alert', kind }); close(); }}>
            <span class="alert-dot alert-{kind.toLowerCase()}"></span>{kind[0] + kind.slice(1).toLowerCase()}
          </button>
        {/each}
      {/snippet}
    </Popover>
    <Popover>
      {#snippet trigger({ toggle, open })}
        <button class="tb" class:on={open} onclick={toggle} title={t('tb.more')}><Icon name="more" /></button>
      {/snippet}
      {#snippet children({ close })}
        <button class="menu-item" onclick={() => { exec({ type: 'hr' }); close(); }}><Icon name="hr" /> {t('tb.hr')}</button>
        <button class="menu-item" onclick={() => { exec({ type: 'footnote' }); close(); }}><Icon name="footnote" /> {t('tb.footnote')}</button>
        <button class="menu-item" onclick={() => { exec({ type: 'details' }); close(); }}><Icon name="details" /> {t('tb.details')}</button>
        <button class="menu-item" onclick={() => { exec({ type: 'pagebreak' }); close(); }}><Icon name="pages" /> {t('tb.pagebreak')}</button>
        <button class="menu-item" onclick={() => { exec({ type: 'date' }); close(); }}><Icon name="date" /> {t('tb.date')}</button>
      {/snippet}
    </Popover>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-wrap: wrap;
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }
  .group { display: flex; align-items: center; gap: 1px; padding: 0 5px; }
  .group + .group { border-left: 1px solid var(--border); }
  .tb.wide { width: auto; padding: 0 5px; gap: 1px; }
  .h-sample { font-weight: 700; width: 2.2em; display: inline-block; }
  .grid-picker { padding: 6px; }
  .grid-row { display: flex; gap: 3px; margin-bottom: 3px; }
  .cell { width: 16px; height: 16px; border: 1px solid var(--border); border-radius: 3px; background: var(--bg); padding: 0; }
  .cell.hot { background: color-mix(in srgb, var(--accent) 35%, transparent); border-color: var(--accent); }
  .grid-label { text-align: center; font-size: 12px; color: var(--fg-muted); padding-top: 4px; font-variant-numeric: tabular-nums; }
  .lang-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; width: 270px; }
  .alert-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  .alert-note { background: #2f81f7; } .alert-tip { background: #2da44e; } .alert-important { background: #8250df; }
  .alert-warning { background: #bf8700; } .alert-caution { background: #cf222e; }
</style>
