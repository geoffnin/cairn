<!-- A row of label/value pairs about one thing: Owner, Created, Last changed, Last used. Wraps to
     two columns on a narrow screen. -->
<script lang="ts">
  let { items }: { items: { label: string; value: string }[] } = $props();
</script>

<dl class="facts">
  {#each items as item (item.label)}<div><dt>{item.label}</dt><dd>{item.value}</dd></div>{/each}
</dl>

<style>
  .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); margin: 0; }
  dt { font: var(--type-small); color: var(--ink-muted); }
  dd { margin: var(--space-1) 0 0; font: var(--type-body); color: var(--ink); overflow-wrap: anywhere; }
</style>
