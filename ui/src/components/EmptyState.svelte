<!-- What a list shows when it has nothing: the mark at 40px and one plain sentence. A search with
     no results drops the mark and says what was searched. -->
<script lang="ts">
  import Mark from "./Mark.svelte";

  let { query = "", filtered = false }: { query?: string; filtered?: boolean } = $props();
</script>

<div class="empty">
  {#if query}
    No links match “{query}”.
  {:else if filtered}
    You have no links yet.
  {:else}
    <Mark size={40} />
    No links yet. Make the first one.
  {/if}
</div>

<style>
  .empty {
    display: grid; justify-items: center; gap: var(--space-3);
    padding: var(--space-8) var(--space-5); text-align: center; color: var(--ink-muted);
  }
</style>
