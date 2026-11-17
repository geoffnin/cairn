<!-- A labelled choice from a short list. -->
<script lang="ts">
  let {
    label, value = $bindable(""), options, onchange,
  }: { label: string; value?: string; options: { value: string; label: string }[]; onchange?: () => void } = $props();
</script>

<label class="field">
  <span class="cn-label">{label}</span>
  <select class="cn-control" bind:value {onchange}>
    {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
  </select>
</label>

<style>
  .field { display: grid; gap: var(--space-1); min-width: 0; }
</style>
