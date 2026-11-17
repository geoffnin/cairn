<!-- A labelled choice from a short list. `inline` puts the label beside the select ("Sort"). -->
<script lang="ts">
  let {
    label, value = $bindable(""), options, inline = false, onchange,
  }: { label: string; value?: string; options: { value: string; label: string }[]; inline?: boolean; onchange?: () => void } = $props();
</script>

<label class="field" class:inline>
  <span class="cn-label">{label}</span>
  <select class="cn-control" bind:value {onchange}>
    {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
  </select>
</label>

<style>
  .field { display: grid; gap: var(--space-1); min-width: 0; }
  .inline { display: inline-flex; align-items: center; gap: var(--space-3); }
  .inline select { width: auto; min-width: 132px; }
</style>
