<!-- The top line of a full page: the mark and lowercase wordmark, one hint, and whatever goes on
     the right (the account, or where links live). No background, no border. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Mark from "./Mark.svelte";

  let { hint, end }: { hint?: Snippet; end?: Snippet } = $props();
</script>

<header>
  <span class="brand"><Mark size={22} />cairn</span>
  {#if hint}<span class="aside">{@render hint()}</span>{/if}
  {#if end}<span class="aside end">{@render end()}</span>{/if}
</header>

<style>
  header { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-1) var(--space-3); }
  .brand {
    display: inline-flex; align-items: center; gap: var(--space-2); align-self: center;
    font: 600 20px/24px var(--font-sans); letter-spacing: -0.02em; color: var(--ink);
  }
  .aside { font: var(--type-small); color: var(--ink-muted); }
  .end { margin-left: auto; }
  .end :global(a) { color: inherit; }
</style>
