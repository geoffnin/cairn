<!-- When the name typed is someone's link already: what it opens, and the two ways on: edit that
     link, or take the free name offered instead. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import { shortUrl } from "../lib/format";
  import GoName from "./GoName.svelte";
  import LinkButton from "./LinkButton.svelte";
  import Notice from "./Notice.svelte";

  type Props = {
    link: Link;
    alternative?: string;
    id?: string;
    onedit?: (link: Link) => void;
    onuse?: (name: string) => void;
  };
  let { link, alternative, id, onedit, onuse }: Props = $props();
</script>

<Notice tone="error" {id}>
  <p class="title"><GoName name={link.slug} /> already exists.</p>
  <p class="dest">→ {shortUrl(link.url)}</p>
  {#if onedit || (alternative && onuse)}
    <p class="actions">
      {#if onedit && (link.can_edit ?? true)}<LinkButton onclick={() => onedit(link)}>Edit go/{link.slug}</LinkButton>{/if}
      {#if alternative && onuse}<LinkButton onclick={() => onuse(alternative)}>Use go/{alternative}</LinkButton>{/if}
    </p>
  {/if}
</Notice>

<style>
  .title { font: var(--type-body); color: var(--clay); }
  .title :global(.go), .title :global(.go)::before { color: inherit; font-weight: 400; }
  .dest { font: var(--type-url); color: var(--ink); overflow-wrap: anywhere; }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-3); }
  .actions :global(.lb) { color: var(--clay); }
</style>
