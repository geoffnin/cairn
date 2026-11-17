<!-- A tinted box that stands apart from a form: `error` (clay) for a problem to fix, `fresh`
     (terracotta-soft, the colour of something just set down) for a result. `id` lets a field
     point at it with aria-describedby. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { tone = "error", id, children }: { tone?: "error" | "fresh"; id?: string; children: Snippet } = $props();
</script>

<div class="notice {tone}" {id}>{@render children()}</div>

<style>
  .notice { display: grid; gap: var(--space-1); padding: var(--space-3); border-radius: var(--radius-md); font: var(--type-small); }
  .error { background: var(--clay-soft); color: var(--ink); }
  .fresh { background: var(--terracotta-soft); color: var(--ink); }
  .notice :global(a) { color: inherit; }
</style>
