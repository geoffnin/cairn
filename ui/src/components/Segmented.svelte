<!-- Two to four peers that take effect at once (density, theme). The chosen one lifts. -->
<script lang="ts">
  let {
    label, value = $bindable(), options, onchange,
  }: { label: string; value: string; options: { value: string; label: string }[]; onchange?: (value: string) => void } = $props();
</script>

<div class="seg" role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" aria-pressed={value === o.value} onclick={() => { value = o.value; onchange?.(o.value); }}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex; gap: 2px; padding: 2px;
    background: var(--surface-sunken); border: 1px solid var(--line); border-radius: var(--radius-md);
  }
  button {
    padding: 4px var(--space-3); border: 0; border-radius: var(--radius-sm);
    font: var(--type-label); color: var(--ink-muted); background: transparent; cursor: pointer;
    transition: background-color 120ms var(--ease-quick), color 120ms var(--ease-quick);
  }
  button:hover { color: var(--ink); }
  button[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-card), 0 0 0 1px var(--line); }
</style>
