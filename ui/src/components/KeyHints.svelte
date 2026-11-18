<!-- The keyboard shortcuts a list answers to, in a line at its foot: "j k move · Enter open". -->
<script lang="ts">
  import Kbd from "./Kbd.svelte";

  let { hints, label = "Keyboard shortcuts" }: { hints: { keys: string[]; label: string }[]; label?: string } = $props();
</script>

<ul class="hints" aria-label={label}>
  {#each hints as h (h.label)}<li><Kbd keys={h.keys} /> {h.label}</li>{/each}
</ul>

<style>
  .hints { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); margin: 0; padding: 0; list-style: none; font: var(--type-small); color: var(--ink-muted); }
  li { display: inline-flex; align-items: center; gap: var(--space-1); }
</style>
