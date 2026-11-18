<!-- The top of a link's page: its name large, its description, what it opens, and the facts
     about it; Copy link, Edit and Delete on the right. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import { formatDate, formatFullDate } from "../lib/format";
  import Button from "./Button.svelte";
  import CopyButton from "./CopyButton.svelte";
  import Facts from "./Facts.svelte";
  import GoName from "./GoName.svelte";

  type Props = {
    link: Link & { created: string; changed?: string };
    now?: Date;
    /** What Copy link puts on the clipboard. */
    shareUrl?: string;
    copy?: (text: string) => Promise<void>;
    onedit?: (link: Link) => void;
    ondelete?: (link: Link) => void;
  };
  let { link, now = new Date(), shareUrl = `http://go/${link.slug}`, copy, onedit, ondelete }: Props = $props();
  const facts = $derived([
    { label: "Owner", value: link.owner ?? "you" },
    { label: "Created", value: formatFullDate(link.created) },
    { label: "Last changed", value: link.changed ? formatDate(link.changed, now) : "Never" },
  ]);
  const editable = $derived(link.can_edit ?? true);
  const id = $props.id();
</script>

<section class="summary" aria-labelledby="{id}-name">
  <div class="top">
    <div class="title">
      <h1 id="{id}-name"><GoName name={link.slug} /></h1>
      {#if link.description}<p class="desc">{link.description}</p>{/if}
    </div>
    <div class="actions">
      <CopyButton variant="primary" label="Copy link" text={shareUrl} {copy} />
      {#if editable && onedit}<Button onclick={() => onedit(link)}>Edit</Button>{/if}
      {#if editable && ondelete}<Button variant="danger" onclick={() => ondelete(link)}>Delete</Button>{/if}
    </div>
  </div>
  <p class="opens">Opens <a href={link.url} rel="noopener noreferrer">{link.url}</a></p>
  <Facts items={facts} />
</section>

<style>
  .summary { display: grid; gap: var(--space-3); }
  .top { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
  h1 { font: 500 26px/32px var(--font-mono); overflow-wrap: anywhere; }
  h1 :global(.go) { font-size: inherit; line-height: inherit; }
  .desc { margin-top: var(--space-1); color: var(--ink-muted); }
  .actions { display: flex; align-items: center; gap: var(--space-2); }
  .opens { font: var(--type-small); color: var(--ink-muted); overflow-wrap: anywhere; }
  .opens a { margin-left: var(--space-1); font: var(--type-url); color: var(--ink); }
  .summary > :global(.facts) { padding-top: var(--space-4); margin-top: var(--space-2); border-top: 1px solid var(--line); }
</style>
