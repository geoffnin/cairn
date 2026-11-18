<!-- A link just made, set down large on terracotta-soft so it reads as the result: the name, and
     where it goes. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import { shortUrl } from "../lib/format";
  import GoName from "./GoName.svelte";

  let { link }: { link: Link } = $props();
</script>

<div class="created">
  <span class="name"><GoName name={link.slug} /></span>
  <span class="dest">→ {shortUrl(link.url)}</span>
</div>

<style>
  .created { display: grid; gap: var(--space-2); padding: var(--space-4); background: var(--terracotta-soft); border-radius: var(--radius-md); animation: cn-settle 180ms var(--ease-settle) both; }
  .name { font: 500 20px/28px var(--font-mono); color: var(--ink); overflow-wrap: anywhere; }
  .dest { font: var(--type-url); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (prefers-reduced-motion: reduce) { .created { animation: none; } }
</style>
