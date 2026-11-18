<!-- One "try it" tip: what to do, a picture of doing it (keys, a go/ name), and a sentence. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, demo, children }: { title: string; demo?: Snippet; children: Snippet } = $props();
</script>

<div class="tip">
  <h3>{title}</h3>
  {#if demo}<div class="demo">{@render demo()}</div>{/if}
  <p>{@render children()}</p>
</div>

<style>
  .tip { display: grid; align-content: start; gap: var(--space-2); }
  h3 { font: var(--type-label); color: var(--ink-muted); }
  .demo { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); min-height: 24px; }
  p { font: var(--type-small); color: var(--ink-muted); }
  p :global(code) { color: var(--ink); }
</style>
