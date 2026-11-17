<!-- Two to four peers that take effect at once (density, theme, a list filter, a chart's range).
     The chosen one takes moss-soft. An option's `count` follows its label, muted. -->
<script lang="ts">
  type Option = { value: string; label: string; count?: number | string };
  let {
    label, value = $bindable(), options, onchange,
  }: { label: string; value: string; options: Option[]; onchange?: (value: string) => void } = $props();
</script>

<div class="seg" role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" aria-pressed={value === o.value} onclick={() => { value = o.value; onchange?.(o.value); }}>
      {o.label}{#if o.count !== undefined}<span class="count">{o.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex; gap: 2px; padding: 2px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-md);
  }
  button {
    display: inline-flex; align-items: baseline; gap: var(--space-1);
    padding: 4px var(--space-3); border: 1px solid transparent; border-radius: var(--radius-sm);
    font: var(--type-label); color: var(--ink); background: transparent; cursor: pointer;
    transition: background-color 120ms var(--ease-quick), border-color 120ms var(--ease-quick);
  }
  button:hover { background: var(--surface-sunken); }
  button[aria-pressed="true"] { background: var(--moss-soft); border-color: var(--moss); }
  .count { font-weight: 400; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
</style>
