<!-- Cards are flat: a hairline and the barest shadow. Padding follows density. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children }: { title?: string; children: Snippet } = $props();
</script>

<section class="card">
  {#if title}<h2>{title}</h2>{/if}
  {@render children()}
</section>

<style>
  .card {
    display: grid; gap: var(--space-3); padding: var(--pad);
    background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }
  h2 { font: var(--type-heading); }
</style>
