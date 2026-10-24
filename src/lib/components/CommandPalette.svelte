<script lang="ts">
  import Picker from './Picker.svelte';
  import { app } from '../state.svelte';
  import { t } from '../i18n';
  import { allCommands, formatShortcut, runCommand, type Command } from '../commands';
  import { fuzzyMatch, highlight } from '../fuzzy';

  function items(q: string) {
    return allCommands()
      .map((c) => ({ c, label: c.label(), m: fuzzyMatch(q, c.label()) }))
      .filter((x) => x.m)
      .sort((a, b) => b.m!.score - a.m!.score)
      .map(({ c, label, m }) => ({
        item: c,
        html: highlight(label, m!.indices),
        hint: formatShortcut(c.shortcut),
        disabled: c.enabled ? !c.enabled() : false,
      }));
  }
</script>

<Picker placeholder={t('cmd.palettePlaceholder')} {items} onpick={(c: Command) => runCommand(c)} onclose={() => (app.paletteOpen = false)} />
