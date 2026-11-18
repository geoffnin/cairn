<!-- The links that already open this page, each with a Copy button: "This page is go/rfc-42".
     Shows the first `limit`; the rest wait behind "Show all 12", and the full list scrolls inside
     the popup rather than pushing the form below out of sight. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import CopyButton from "./CopyButton.svelte";
  import GoName from "./GoName.svelte";
  import LinkButton from "./LinkButton.svelte";

  type Props = { links: Link[]; limit?: number; copy?: (text: string) => Promise<void>; oncopied?: (text: string) => void };
  let { links, limit = 3, copy, oncopied }: Props = $props();
  let expanded = $state(false);
  const id = $props.id();
  // One more than the limit would hide a single row behind a button as tall as the row.
  const fits = $derived(links.length <= limit + 1);
  const shown = $derived(fits || expanded ? links : links.slice(0, limit));
</script>

<div class="existing">
  <ul id="{id}-list" class:scrolls={expanded && !fits}>
    {#each shown as link (link.slug)}
      <li><GoName name={link.slug} title={link.description || undefined} /><CopyButton small text="go/{link.slug}" {copy} {oncopied} /></li>
    {/each}
  </ul>
  {#if !fits}
    <LinkButton muted aria-expanded={expanded} aria-controls="{id}-list" onclick={() => (expanded = !expanded)}>
      {expanded ? "Show fewer" : `Show all ${links.length}`}
    </LinkButton>
  {/if}
</div>

<style>
  .existing { display: grid; justify-items: start; gap: var(--space-2); }
  ul { display: grid; gap: var(--space-1); width: 100%; margin: 0; padding: 0; list-style: none; }
  /* About five and a half rows, so the cut-off row says there is more to scroll to. */
  .scrolls { max-height: 236px; overflow-y: auto; overscroll-behavior: contain; }
  li {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-2);
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-3);
    background: var(--surface-sunken); border-radius: var(--radius-md);
  }
  li :global(.go) { overflow: hidden; text-overflow: ellipsis; }
</style>
