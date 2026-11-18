<!-- Links whose names are close to one that does not exist: "Did you mean…". Each row is a link
     to it, with its description and where it goes. Shows the first `limit`; the rest wait behind
     "Show all 50", since a common stem can match dozens of names. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import { shortUrl } from "../lib/format";
  import GoName from "./GoName.svelte";
  import LinkButton from "./LinkButton.svelte";

  type Props = { links: Link[]; href: (link: Link) => string; label?: string; limit?: number };
  let { links, href, label = "Similar links", limit = 5 }: Props = $props();
  let expanded = $state(false);
  const id = $props.id();
  // One more than the limit would hide a single row behind a line as tall as the row.
  const fits = $derived(links.length <= limit + 1);
  const shown = $derived(fits || expanded ? links : links.slice(0, limit));
</script>

<div class="wrap">
  <ul class="similar" id="{id}-list" aria-label={label}>
    {#each shown as link (link.slug)}
      <li>
        <a href={href(link)}>
          <span class="name"><GoName name={link.slug} /></span>
          <span class="about">{[link.description, shortUrl(link.url)].filter(Boolean).join(" · ")}</span>
        </a>
      </li>
    {/each}
  </ul>
  {#if !fits}
    <LinkButton muted aria-expanded={expanded} aria-controls="{id}-list" onclick={() => (expanded = !expanded)}>
      {expanded ? "Show fewer" : `Show all ${links.length}`}
    </LinkButton>
  {/if}
</div>

<style>
  .wrap { display: grid; justify-items: start; gap: var(--space-2); }
  .similar { width: 100%; margin: 0; padding: 0; list-style: none; overflow: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
  li + li { border-top: 1px solid var(--line); }
  a {
    display: grid; grid-template-columns: minmax(0, 24%) minmax(0, 1fr); align-items: baseline; gap: var(--space-4);
    padding: var(--space-3) var(--space-4); color: var(--ink); text-decoration: none;
    transition: background-color 120ms var(--ease-quick);
  }
  a:hover { background: var(--surface-sunken); }
  a:hover .name :global(.go) { color: var(--moss); }
  .name :global(.go) { display: block; overflow: hidden; text-overflow: ellipsis; }
  .about { font: var(--type-small); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 560px) {
    a { grid-template-columns: minmax(0, 1fr); gap: var(--space-1); }
  }
</style>
