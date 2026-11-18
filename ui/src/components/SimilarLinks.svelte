<!-- Links whose names are close to one that does not exist: "Did you mean…". Each row is a link
     to it, with its description, where it goes and how much it is used. -->
<script lang="ts">
  import type { UsedLink } from "../lib/links";
  import { formatCount, shortUrl } from "../lib/format";
  import GoName from "./GoName.svelte";

  let { links, href, label = "Similar links" }: { links: UsedLink[]; href: (link: UsedLink) => string; label?: string } = $props();
</script>

<ul class="similar" aria-label={label}>
  {#each links as link (link.slug)}
    <li>
      <a href={href(link)}>
        <span class="name"><GoName name={link.slug} /></span>
        <span class="about">{[link.description, shortUrl(link.url)].filter(Boolean).join(" · ")}</span>
        <span class="uses">{formatCount(link.uses)} uses</span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .similar { margin: 0; padding: 0; list-style: none; overflow: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
  li + li { border-top: 1px solid var(--line); }
  a {
    display: grid; grid-template-columns: minmax(0, 24%) minmax(0, 1fr) auto; align-items: baseline; gap: var(--space-4);
    padding: var(--space-3) var(--space-4); color: var(--ink); text-decoration: none;
    transition: background-color 120ms var(--ease-quick);
  }
  a:hover { background: var(--surface-sunken); }
  a:hover .name :global(.go) { color: var(--moss); }
  .name :global(.go) { display: block; overflow: hidden; text-overflow: ellipsis; }
  .about { font: var(--type-small); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .uses { font: var(--type-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  @media (max-width: 560px) {
    a { grid-template-columns: minmax(0, 1fr) auto; }
    .about { grid-column: 1 / -1; grid-row: 2; }
  }
</style>
