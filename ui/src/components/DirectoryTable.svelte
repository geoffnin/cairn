<!-- The server's list of all links. One row can be selected and moved
     with j and k; Enter opens it, y copies it, e edits it (the keys work anywhere on the page but in
     a field). A link just made (`fresh`) carries the terracotta marker. The foot says how many of
     how many are shown, and the keys. -->
<script lang="ts">
  import type { DirectoryLink } from "../lib/links";
  import { formatAgo, formatCount, formatOwner, shortUrl } from "../lib/format";
  import { PASS_THROUGH } from "../lib/passthrough";
  import EmptyState from "./EmptyState.svelte";
  import GoName from "./GoName.svelte";
  import KeyHints from "./KeyHints.svelte";

  type Props = {
    links: DirectoryLink[];
    /** All links on the server, for "8 of 214". */
    total?: number;
    href: (link: DirectoryLink) => string;
    me?: string;
    now?: Date;
    fresh?: string | null;
    selected?: number;
    query?: string;
    onopen?: (link: DirectoryLink) => void;
    oncopy?: (link: DirectoryLink) => void;
    onedit?: (link: DirectoryLink) => void;
  };
  let {
    links, total = links.length, href, me, now = new Date(), fresh = null, selected = $bindable(-1), query = "",
    onopen, oncopy, onedit,
  }: Props = $props();
  let body: HTMLTableSectionElement;

  function onWindowKey(e: KeyboardEvent) {
    const target = e.target as Element | null;
    if (e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, dialog, [contenteditable]")) return;
    const current = links[selected];
    if (e.key === "j" || e.key === "k") {
      e.preventDefault();
      selected = Math.min(links.length - 1, Math.max(0, selected + (e.key === "j" ? 1 : -1)));
      const row = body?.rows[selected];
      row?.scrollIntoView({ block: "nearest" });
      // When focus is in the list, it follows the selection, so Enter opens the selected link.
      if (body?.contains(document.activeElement)) row?.querySelector<HTMLElement>("a")?.focus();
    } else if (current && e.key === "Enter" && !target?.closest("a, button")) {
      e.preventDefault();
      if (onopen) onopen(current);
      else body?.rows[selected]?.querySelector<HTMLElement>("a")?.click();
    } else if (current && e.key === "y") {
      oncopy?.(current);
    } else if (current && e.key === "e") {
      onedit?.(current);
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<section class="directory" aria-label="Links">
  <div class="wrap">
    <table>
      <colgroup><col class="name" /><col /><col class="owner" /><col class="num" /></colgroup>
      <thead>
        <tr><th scope="col">Name</th><th scope="col">Destination</th><th scope="col">Owner</th><th scope="col" class="r">Updated</th></tr>
      </thead>
      <tbody bind:this={body}>
        {#each links as link, i (link.slug)}
          <tr class:fresh={link.slug === fresh} class:selected={i === selected} aria-current={i === selected ? "true" : undefined} onclick={() => (selected = i)}>
            <td class="name">
              <GoName name={link.slug} href={href(link)} />{#if link.url.includes(PASS_THROUGH)}<span class="rest">/{PASS_THROUGH}</span>{/if}
            </td>
            <td>
              <span class="dest" title={link.url}>{shortUrl(link.url, { scheme: true })}</span>
              {#if link.description}<span class="desc">{link.description}</span>{/if}
            </td>
            <td class="owner" title={link.owner}>{formatOwner(link.owner, me)}</td>
            <td class="r when"><time datetime={link.updated}>{formatAgo(link.updated, now)}</time></td>
          </tr>
        {:else}
          <tr><td colspan="4"><EmptyState {query} /></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="foot">
    <span>{formatCount(links.length)} of {formatCount(total)}</span>
    <KeyHints hints={[{ keys: ["j", "k"], label: "move" }, { keys: ["Enter"], label: "open" }, { keys: ["y"], label: "copy" }, { keys: ["e"], label: "edit" }]} />
  </div>
</section>

<style>
  .directory { overflow: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
  .wrap { overflow-x: auto; }
  table { width: 100%; min-width: 640px; border-collapse: collapse; table-layout: fixed; }
  col.name { width: 24%; }
  col.owner { width: 16%; }
  col.num { width: 14%; }
  th { padding: var(--space-3) var(--space-4); text-align: left; font: var(--type-label); color: var(--ink-muted); border-bottom: 1px solid var(--line); }
  .r { text-align: right; }
  td { padding: var(--space-2) var(--space-4); height: 52px; border-bottom: 1px solid var(--line); vertical-align: middle; overflow: hidden; }
  tr { cursor: default; transition: background-color 120ms var(--ease-quick); }
  tbody tr:hover, .selected { background: var(--surface-sunken); }
  td.name { position: relative; white-space: nowrap; text-overflow: ellipsis; }
  .rest { font: var(--type-go-name); color: var(--ink-muted); font-weight: 400; }
  .dest { display: block; font: var(--type-url); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .desc { display: block; font: var(--type-small); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .owner, .when { font-size: 13px; color: var(--ink-muted); white-space: nowrap; text-overflow: ellipsis; }
  .fresh { background: var(--terracotta-soft); }
  .fresh:hover { background: var(--terracotta-soft); }
  .fresh td.name::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--terracotta); }
  .foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-3) var(--space-4); font: var(--type-small); color: var(--ink-muted); }
</style>
