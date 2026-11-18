<!-- Stories only: draws a popup as Chrome shows it, a card under the toolbar, with a caption. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { caption, children }: { caption?: string; children: Snippet } = $props();
</script>

<figure>
  {#if caption}<figcaption>{caption}</figcaption>{/if}
  <div class="frame">{@render children()}</div>
</figure>

<style>
  figure { display: grid; gap: var(--space-3); align-content: start; margin: 0; }
  figcaption { font: var(--type-small); color: var(--ink-muted); }
  .frame { width: max-content; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-menu); }
</style>
