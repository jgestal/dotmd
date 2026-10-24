<script lang="ts">
  import Icon from './Icon.svelte';
  import { app, settings, DEFAULT_SETTINGS, type StatKey, type Settings } from '../state.svelte';
  import { t, LANGUAGES, type Key } from '../i18n';
  import { THEMES, FONTS } from '../themes';
  import { keySound, bellSound } from '../sound';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { toggleTypewriterMode, typewriterModeOn } from '../actions';

  const SOUND_CREDITS = [
    ['exterminat', 'https://freesound.org/people/exterminat/sounds/164807/'],
    ['NHumphrey', 'https://freesound.org/people/NHumphrey/sounds/204466/'],
    ['knufds', 'https://freesound.org/people/knufds/sounds/345955/'],
  ];

  type Section = 'appearance' | 'typography' | 'editor' | 'zen' | 'stats' | 'export' | 'advanced';
  let section = $state<Section>('appearance');
  const sections: [Section, Key, string][] = [
    ['appearance', 'set.appearance', 'highlight'],
    ['typography', 'set.typography', 'heading'],
    ['editor', 'set.editor', 'visual'],
    ['zen', 'set.zen', 'zen'],
    ['stats', 'set.stats', 'target'],
    ['export', 'set.export', 'export'],
    ['advanced', 'set.advanced', 'code'],
  ];
  const ACCENTS = ['', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#8e8e93'];
  const STAT_KEYS: [StatKey, Key][] = [
    ['words', 'stats.words'], ['chars', 'stats.chars'], ['charsNoSpaces', 'stats.charsNoSpaces'], ['letters', 'stats.letters'],
    ['sentences', 'stats.sentences'], ['paragraphs', 'stats.paragraphs'], ['lines', 'stats.lines'], ['reading', 'stats.reading'],
    ['speaking', 'stats.speaking'], ['selection', 'stats.selection'], ['goal', 'stats.goal'], ['session', 'stats.session'],
  ];

  function resetAll() {
    const lang = settings.lang;
    Object.assign(settings, structuredClone(DEFAULT_SETTINGS), { lang });
  }
  function reset<K extends keyof Settings>(...keys: K[]) {
    for (const k of keys) (settings as any)[k] = structuredClone(DEFAULT_SETTINGS[k]);
  }
</script>

<div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && (app.settingsOpen = false)}>
  <div class="dialog settings" role="dialog" aria-label={t('set.title')}>
    <nav>
      <h2>{t('set.title')}</h2>
      {#each sections as [id, label, icon]}
        <button class="nav-item" class:on={section === id} onclick={() => (section = id)}><Icon name={icon} size={15} /> {t(label)}</button>
      {/each}
    </nav>
    <section>
      <button class="tb close" onclick={() => (app.settingsOpen = false)} title={t('common.close')}><Icon name="x" /></button>

      {#if section === 'appearance'}
        <div class="row">
          <span>{t('set.language')}</span>
          <select bind:value={settings.lang}>
            {#each LANGUAGES as l}<option value={l.id}>{l.label}</option>{/each}
          </select>
        </div>
        <h3>{t('set.theme')}</h3>
        <div class="themes">
          <button class="theme-card auto" class:on={settings.theme === 'auto'} onclick={() => (settings.theme = 'auto')}>
            <span class="swatch split"><span style="background:#fff"></span><span style="background:#1c1c1e"></span></span>
            <span>{t('set.themeAuto')}</span>
          </button>
          {#each THEMES as th}
            <button class="theme-card" class:on={settings.theme === th.id} onclick={() => (settings.theme = th.id)}>
              <span class="swatch" style="background:{th.vars['--bg']};color:{th.vars['--fg']};font-family:{th.fonts.doc};border-color:{th.vars['--border']}">
                <b style="font-family:{th.fonts.heading}">Aa</b>
                <i style="background:{th.vars['--accent']}"></i>
                {#if th.kind === 'crt'}<em class="scan"></em>{/if}
                {#if th.kind === 'tractor'}<em class="bands" style="--b:{th.vars['--band']};--p:{th.vars['--paper']};--h:{th.vars['--bg']}"></em>{/if}
              </span>
              <span>{th.name}</span>
            </button>
          {/each}
        </div>
        <h3>{t('set.accent')}</h3>
        <div class="accents">
          {#each ACCENTS as a}
            <button class="accent" class:on={settings.accent === a} style="background:{a || 'conic-gradient(#0a84ff, #ff375f, #ffd60a, #30d158, #0a84ff)'}"
              title={a || t('set.accentTheme')} aria-label={a || t('set.accentTheme')} onclick={() => (settings.accent = a)}></button>
          {/each}
          <input type="color" value={settings.accent || '#0a84ff'} oninput={(e) => (settings.accent = e.currentTarget.value)} />
        </div>
        <h3>{t('set.effects')}</h3>
        <label class="check"><input type="checkbox" bind:checked={settings.crtScanlines} /> {t('set.crtScanlines')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.crtGlow} /> {t('set.crtGlow')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.crtFlicker} /> {t('set.crtFlicker')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.crtCurvature} /> {t('set.crtCurvature')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.paperTexture} /> {t('set.paperTexture')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.inkVariation} /> {t('set.inkVariation')}</label>
        <div class="row">
          <span>{t('set.sidebarSide')}</span>
          <div class="seg">
            <button class:on={settings.sidebarSide === 'left'} onclick={() => (settings.sidebarSide = 'left')}>{t('set.left')}</button>
            <button class:on={settings.sidebarSide === 'right'} onclick={() => (settings.sidebarSide = 'right')}>{t('set.right')}</button>
          </div>
        </div>

      {:else if section === 'typography'}
        <div class="sample markdown-body" class:justify={settings.justify}>
          <h3>Lorem ipsum</h3>
          <p>{t('set.preview')} {t('set.preview')} <code>code()</code></p>
        </div>
        {#each [['docFont', 'set.docFont'], ['headingFont', 'set.headingFont'], ['codeFont', 'set.codeFont']] as [k, label]}
          <div class="row">
            <span>{t(label as Key)}</span>
            <select bind:value={(settings as any)[k]}>
              <option value="theme">{t('set.fontTheme')}</option>
              {#each Object.entries(FONTS) as [id, f]}<option value={id} style="font-family:{f.stack}">{f.label}</option>{/each}
            </select>
          </div>
        {/each}
        <div class="row"><span>{t('set.fontSize')} <b>{settings.fontSize}px</b></span><input type="range" min="12" max="28" step="1" bind:value={settings.fontSize} /></div>
        <div class="row"><span>{t('set.lineHeight')} <b>{settings.lineHeight.toFixed(2)}</b></span><input type="range" min="1.1" max="2.4" step="0.05" bind:value={settings.lineHeight} /></div>
        <div class="row"><span>{t('set.docWidth')} <b>{settings.docWidth}px</b></span><input type="range" min="480" max="1400" step="20" bind:value={settings.docWidth} /></div>
        <div class="row"><span>{t('set.paragraphSpacing')} <b>{settings.paragraphSpacing.toFixed(2)}em</b></span><input type="range" min="0.3" max="2.5" step="0.05" bind:value={settings.paragraphSpacing} /></div>
        <label class="check"><input type="checkbox" bind:checked={settings.justify} /> {t('set.justify')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.hyphenate} /> {t('set.hyphenate')}</label>
        <button class="btn" onclick={() => reset('docFont', 'headingFont', 'codeFont', 'fontSize', 'lineHeight', 'docWidth', 'paragraphSpacing', 'justify', 'hyphenate')}>{t('common.reset')}</button>

      {:else if section === 'editor'}
        <div class="row">
          <span>{t('set.defaultMode')}</span>
          <select bind:value={settings.defaultMode}>
            <option value="preview">{t('mode.preview')}</option>
            <option value="source">{t('mode.source')}</option>
            <option value="split">{t('mode.split')}</option>
            <option value="visual">{t('mode.visual')}</option>
          </select>
        </div>
        <label class="check"><input type="checkbox" bind:checked={settings.showToolbar} /> {t('set.showToolbar')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.lineNumbers} /> {t('set.lineNumbers')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.lineWrap} /> {t('set.lineWrap')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.spellcheck} /> {t('set.spellcheck')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.autosave} /> {t('set.autosave')}</label>

      {:else if section === 'zen'}
        <button class="tw-card" class:on={typewriterModeOn()} onclick={toggleTypewriterMode}>
          <span class="tw-icon" aria-hidden="true">⌨︎</span>
          <span class="tw-text">
            <b>{t('set.twMode')}</b>
            <small>{t('set.twModeHint')}</small>
          </span>
          <span class="tw-state">{typewriterModeOn() ? t('set.twModeOn') : t('set.twModeOff')}</span>
        </button>
        <div class="row">
          <span>{t('set.focusMode')}</span>
          <div class="seg">
            {#each [['off', 'set.focusOff'], ['line', 'set.focusLine'], ['sentence', 'set.focusSentence'], ['paragraph', 'set.focusParagraph']] as [v, l]}
              <button class:on={settings.focusMode === v} onclick={() => (settings.focusMode = v as any)}>{t(l as Key)}</button>
            {/each}
          </div>
        </div>
        <label class="check indent"><input type="checkbox" bind:checked={settings.focusOnlyZen} /> {t('set.onlyZen')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.typewriterScroll} /> {t('set.typewriterScroll')}</label>
        <label class="check indent"><input type="checkbox" bind:checked={settings.typewriterOnlyZen} /> {t('set.onlyZen')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.zenFullscreen} /> {t('set.zenFullscreen')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.zenShowStats} /> {t('set.zenShowStats')}</label>
        <h3>{t('set.typingSound')}</h3>
        <div class="seg">
          {#each [['off', 'set.soundOff'], ['typewriter', 'set.soundTypewriter'], ['mechanical', 'set.soundMechanical'], ['soft', 'set.soundSoft']] as [v, l]}
            <button class:on={settings.typingSound === v} onclick={() => { settings.typingSound = v as any; keySound('a'); }}>{t(l as Key)}</button>
          {/each}
        </div>
        <div class="row"><span>{t('set.volume')}</span><input type="range" min="0" max="1" step="0.05" bind:value={settings.soundVolume} onchange={() => keySound('Enter')} /></div>
        <label class="check indent"><input type="checkbox" bind:checked={settings.soundOnlyZen} /> {t('set.onlyZen')}</label>
        <label class="check"><input type="checkbox" bind:checked={settings.stereoKeys} /> {t('set.stereoKeys')}</label>
        <div class="row">
          <span>{t('set.bellColumn')} <b>{settings.bellColumn || t('set.bellOff')}</b></span>
          <span class="inline">
            <input type="range" min="0" max="120" step="1" bind:value={settings.bellColumn} />
            <button class="btn small" onclick={bellSound}>{t('set.testBell')}</button>
          </span>
        </div>

      {:else if section === 'stats'}
        <label class="check"><input type="checkbox" bind:checked={settings.showStats} /> {t('set.showStats')}</label>
        <h3>{t('set.statsVisible')}</h3>
        <div class="stat-grid">
          {#each STAT_KEYS as [k, l]}
            <label class="check"><input type="checkbox" bind:checked={settings.stats[k]} /> {t(l)}</label>
          {/each}
        </div>
        <div class="row"><span>{t('stats.setGoal')}</span><input type="number" min="0" step="100" bind:value={settings.wordGoal} /></div>
        <div class="row"><span>{t('set.readingWpm')}</span><input type="number" min="60" max="800" step="10" bind:value={settings.readingWpm} /></div>

      {:else if section === 'export'}
        <div class="row">
          <span>{t('export.theme')}</span>
          <select bind:value={settings.exportTheme}>
            <option value="current">{t('export.themeCurrent')}</option>
            <option value="modern">Modern</option>
            <option value="github">GitHub</option>
            <option value="paper">Paper</option>
            <option value="typewriter">Typewriter</option>
            <option value="tractor">Continuous Paper</option>
          </select>
        </div>
        <div class="row">
          <span>{t('export.page')}</span>
          <select bind:value={settings.pdfPageSize}>{#each ['A4', 'Letter', 'A5', 'Legal'] as p}<option>{p}</option>{/each}</select>
        </div>
        <label class="check"><input type="checkbox" bind:checked={settings.exportEmbedFonts} /> {t('export.embedFonts')}</label>
        <div class="row"><span>{t('export.margin')} <b>{settings.pdfMargin}</b></span><input type="range" min="0" max="40" bind:value={settings.pdfMargin} /></div>

      {:else}
        <h3>{t('set.customCss')}</h3>
        <p class="hint">{t('set.customCssHint')}</p>
        <textarea bind:value={settings.customCss} rows="12" spellcheck="false" placeholder=".markdown-body h1 {'{'} color: tomato {'}'}"></textarea>
        <button class="btn danger" onclick={resetAll}>{t('set.resetAll')}</button>
        <h3>{t('set.credits')}</h3>
        <p class="hint">
          {t('set.creditsSounds')}
          {#each SOUND_CREDITS as [name, url], i}
            <button class="linkish" onclick={() => openUrl(url)}>{name}</button>{i < SOUND_CREDITS.length - 1 ? ', ' : '.'}
          {/each}
        </p>
      {/if}
    </section>
  </div>
</div>

<style>
  .settings { display: grid; grid-template-columns: 190px 1fr; width: min(820px, calc(100vw - 40px)); height: min(600px, calc(100vh - 60px)); padding: 0; overflow: hidden; }
  nav { background: var(--bg-elev); border-right: 1px solid var(--border); padding: 18px 8px; }
  h2 { font-size: 15px; margin: 0 8px 14px; }
  .nav-item { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; color: var(--fg); font: 13px var(--font-ui); padding: 7px 10px; border-radius: 7px; text-align: left; cursor: default; }
  .nav-item.on { background: var(--accent); color: var(--accent-fg); }
  section { position: relative; padding: 44px 26px 22px; overflow-y: auto; font-size: 13px; }
  .close { position: absolute; right: 12px; top: 12px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-muted); margin: 20px 0 10px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 34px; }
  .row input[type=range] { width: 220px; }
  .row b { color: var(--fg-muted); font-weight: 500; margin-left: 6px; font-variant-numeric: tabular-nums; }
  .check { display: flex; align-items: center; gap: 8px; min-height: 28px; }
  .check.indent { padding-left: 24px; color: var(--fg-muted); }
  .themes { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; }
  .theme-card { display: grid; gap: 6px; border: 0; background: none; color: var(--fg); font: 12px var(--font-ui); padding: 0; text-align: center; cursor: default; }
  .swatch { position: relative; display: flex; align-items: center; justify-content: center; height: 62px; border-radius: 9px; border: 1px solid var(--border); overflow: hidden; font-size: 20px; }
  .swatch i { position: absolute; bottom: 8px; left: 10px; right: 50%; height: 4px; border-radius: 2px; }
  .swatch .bands {
    position: absolute; inset: 0; z-index: 0;
    background:
      radial-gradient(circle, var(--h) 0 2.5px, transparent 3px) left top / 12px 12px repeat-y,
      radial-gradient(circle, var(--h) 0 2.5px, transparent 3px) right top / 12px 12px repeat-y,
      repeating-linear-gradient(to bottom, var(--b) 0 8px, var(--p) 8px 16px);
  }
  .swatch b, .swatch i { position: relative; z-index: 1; }
  .swatch .scan { position: absolute; inset: 0; background: repeating-linear-gradient(transparent 0 2px, rgba(0,0,0,.35) 2px 3px); }
  .swatch.split span { flex: 1; height: 100%; }
  .theme-card.on .swatch { outline: 2.5px solid var(--accent); outline-offset: 2px; }
  .accents { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .accent { width: 22px; height: 22px; border-radius: 50%; border: 0; padding: 0; cursor: default; }
  .accent.on { outline: 2px solid var(--fg); outline-offset: 2px; }
  .accents input[type=color] { width: 30px; height: 24px; padding: 0; border: 0; background: none; }
  .seg { display: inline-flex; background: var(--bg-active); border-radius: 8px; padding: 2px; flex-wrap: wrap; }
  .seg button { border: 0; background: none; color: var(--fg); font: 12px var(--font-ui); padding: 4px 10px; border-radius: 6px; cursor: default; }
  .seg button.on { background: var(--bg); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
  .sample { border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; margin-bottom: 14px; background: var(--bg); }
  .sample h3 { text-transform: none; letter-spacing: 0; color: var(--fg); font-size: 1.25em; margin: 0 0 0.4em; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; }
  textarea { width: 100%; font: 12px var(--font-code); }
  .hint { color: var(--fg-muted); }
  .btn { margin-top: 14px; }
  .btn.danger { color: #ff453a; }
  .btn.small { margin: 0; padding: 3px 8px; font-size: 12px; }
  .inline { display: flex; align-items: center; gap: 8px; }
  .inline input[type=range] { width: 160px; }
  .linkish { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; cursor: pointer; }
  .tw-card {
    display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; margin-bottom: 14px;
    padding: 14px 16px; border-radius: 12px; border: 1px solid var(--border); cursor: default;
    background: linear-gradient(135deg, #f1ead6, #e6dcc0); color: #26231f; font-family: 'Courier Prime', monospace;
  }
  .tw-card.on { outline: 2.5px solid var(--accent); outline-offset: 2px; }
  .tw-icon { font-size: 30px; }
  .tw-text { flex: 1; display: grid; gap: 3px; }
  .tw-text b { font-family: 'Special Elite', monospace; font-weight: 400; font-size: 16px; }
  .tw-text small { font-size: 11.5px; color: #6d6556; }
  .tw-state { font: 600 11.5px var(--font-ui); color: #a5281b; max-width: 130px; text-align: right; }
</style>
