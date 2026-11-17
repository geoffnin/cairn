<!-- A destination URL as people read it: scheme dropped, host in ink, the rest muted, the full
     URL in the tooltip. -->
<script lang="ts">
  import { splitDestination } from "../lib/links";

  let { url }: { url: string } = $props();
  const parts = $derived(splitDestination(url));
</script>

<span class="dest" title={url}>
  {#if parts}<span class="host">{parts.host}</span>{parts.rest}{:else}{url}{/if}
</span>

<style>
  .dest {
    display: block; font-size: 13px; line-height: 20px; color: var(--ink-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .host { color: var(--ink); }
</style>
