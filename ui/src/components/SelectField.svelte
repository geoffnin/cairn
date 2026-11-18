<!-- A labelled choice from a short list. `inline` puts the label beside the select ("Sort").
     The browser's own arrow is replaced by a chevron inset as far from the right edge as the text
     is from the left. -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    label, value = $bindable(""), options, inline = false, onchange,
  }: { label: string; value?: string; options: { value: string; label: string }[]; inline?: boolean; onchange?: () => void } = $props();
</script>

<label class="field" class:inline>
  <span class="cn-label">{label}</span>
  <span class="box">
    <select class="cn-control" bind:value {onchange}>
      {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
    </select>
    <span class="chevron"><Icon name="chevron" /></span>
  </span>
</label>

<style>
  .field { display: grid; gap: var(--space-1); min-width: 0; }
  .inline { display: inline-flex; align-items: center; gap: var(--space-3); }
  .box { position: relative; display: block; }
  .inline .box { display: inline-block; }
  select { appearance: none; padding-right: calc(var(--space-3) + 16px + var(--space-2)); cursor: pointer; }
  .inline select { width: auto; min-width: 132px; }
  .chevron {
    position: absolute; right: var(--space-3); top: 50%; transform: translateY(-50%);
    display: flex; color: var(--ink-muted); pointer-events: none;
  }
</style>
