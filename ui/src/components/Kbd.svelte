<!-- A key, or a few keys, as a hint next to the thing they do: Enter, /, ⌘C, j k. Inside a
     primary button it turns light on moss. -->
<script lang="ts">
  let { keys }: { keys: string | string[] } = $props();
  const list = $derived(Array.isArray(keys) ? keys : [keys]);
</script>

<span class="keys">{#each list as key, i (i)}<kbd class="cn-kbd">{key}</kbd>{/each}</span>

<style>
  .keys { display: inline-flex; gap: 2px; vertical-align: baseline; }
  :global(.btn.primary) .cn-kbd { color: var(--on-moss); background: rgb(255 255 255 / .14); border-color: transparent; }
</style>
