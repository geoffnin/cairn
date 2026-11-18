<!-- The links that already open this page, each with a Copy button: "This page is go/rfc-42". -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import CopyButton from "./CopyButton.svelte";
  import GoName from "./GoName.svelte";

  type Props = { links: Link[]; copy?: (text: string) => Promise<void>; oncopied?: (text: string) => void };
  let { links, copy, oncopied }: Props = $props();
</script>

<ul class="existing">
  {#each links as link (link.slug)}
    <li><GoName name={link.slug} title={link.description || undefined} /><CopyButton small text="go/{link.slug}" {copy} {oncopied} /></li>
  {/each}
</ul>

<style>
  .existing { display: grid; gap: var(--space-1); margin: 0; padding: 0; list-style: none; }
  li {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    background: var(--surface-sunken); border-radius: var(--radius-md);
  }
  li :global(.go) { overflow: hidden; text-overflow: ellipsis; }
</style>
