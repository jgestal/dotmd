<script lang="ts">
  import '@fontsource-variable/inter';
  import '@fontsource-variable/literata';
  import '@fontsource/ibm-plex-serif/400.css';
  import '@fontsource/ibm-plex-serif/400-italic.css';
  import '@fontsource/ibm-plex-serif/600.css';
  import '@fontsource/ibm-plex-mono/400.css';
  import '@fontsource/courier-prime/400.css';
  import '@fontsource/courier-prime/400-italic.css';
  import '@fontsource/courier-prime/700.css';
  import '@fontsource/special-elite';
  import '@fontsource/vt323';
  import '@fontsource/doto/600.css';
  import '@fontsource/doto/800.css';
  import 'katex/dist/katex.min.css';
  import '$lib/styles/document.css';
  import '$lib/styles/app.css';

  let { children } = $props();
</script>

{@render children()}
