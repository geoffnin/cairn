<!-- The list of links. Rows follow density (--row); Comfortable adds the description line.
     A link just created or edited (`fresh`) settles in with the terracotta marker. Row actions
     appear on hover, focus or touch. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import Button from "./Button.svelte";
  import Destination from "./Destination.svelte";
  import EmptyState from "./EmptyState.svelte";
  import GoName from "./GoName.svelte";

  type Props = {
    links: Link[];
    href: (link: Link) => string;
    shared?: boolean;
    fresh?: string | null;
    query?: string;
    filtered?: boolean;
    /** True until the first load answers: show no rows rather than "No links yet". */
    loading?: boolean;
    onedit: (link: Link) => void;
    ondelete: (link: Link) => void;
  };
  let { links, href, shared = false, fresh = null, query = "", filtered = false, loading = false, onedit, ondelete }: Props = $props();
  const columns = $derived(shared ? 4 : 3);
</script>

<div class="wrap">
  <table>
    <colgroup>
      <col class="name" /><col />{#if shared}<col class="owner" />{/if}<col class="actions" />
    </colgroup>
    <thead>
      <tr><th>Name</th><th>Destination</th>{#if shared}<th>Owner</th>{/if}<th></th></tr>
    </thead>
    <tbody>
      {#each links as link (link.slug)}
        <tr class="row" class:fresh={link.slug === fresh}>
          <td>
            <GoName name={link.slug} href={href(link)} title={link.description || undefined} />
            {#if link.description}<span class="desc">{link.description}</span>{/if}
          </td>
          <td><Destination url={link.url} /></td>
          {#if shared}<td class="owner" title={link.owner}>{link.owner}</td>{/if}
          <td class="actions">
            {#if link.metrics_url}
              <Button variant="quiet" small href={link.metrics_url} target="_blank" rel="noopener noreferrer" title="Open the metrics dashboard for go/{link.slug}">Metrics ↗</Button>
            {/if}
            {#if link.can_edit ?? true}
              <Button variant="quiet" small onclick={() => onedit(link)}>Edit</Button>
              <Button variant="danger" small onclick={() => ondelete(link)}>Delete</Button>
            {/if}
          </td>
        </tr>
      {:else}
        {#if !loading}<tr><td colspan={columns}><EmptyState {query} {filtered} /></td></tr>{/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap { overflow-x: auto; }
  table { width: 100%; min-width: 520px; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
  col.name { width: 30%; }
  col.owner { width: 16%; }
  col.actions { width: 168px; }
  th {
    padding: var(--space-2) var(--space-4); text-align: left;
    font: var(--type-label); color: var(--ink-muted); background: var(--surface-sunken);
  }
  th:first-child { border-radius: var(--radius-md) 0 0 var(--radius-md); }
  th:last-child { border-radius: 0 var(--radius-md) var(--radius-md) 0; }

  .row { height: var(--row); transition: background-color 120ms var(--ease-quick); }
  .row td { padding: 0 var(--space-4); border-bottom: 1px solid var(--line); vertical-align: middle; overflow: hidden; }
  .row:last-child td { border-bottom: 0; }
  .row:hover { background: var(--surface-sunken); }
  .row td:first-child { position: relative; }
  .row :global(.go) { display: block; overflow: hidden; text-overflow: ellipsis; }
  .desc {
    display: none; font: var(--type-small); color: var(--ink-faint);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  :global([data-density="comfortable"]) .desc { display: block; }
  td.owner { font-size: 13px; color: var(--ink-muted); white-space: nowrap; text-overflow: ellipsis; }
  td.actions { text-align: right; white-space: nowrap; }
  td.actions > :global(*) { opacity: 0; transition: opacity 120ms var(--ease-quick); }
  .row:is(:hover, :focus-within) td.actions > :global(*) { opacity: 1; }
  @media (hover: none) { td.actions > :global(*) { opacity: 1; } }

  /* A stone set down. */
  .fresh { animation: cn-settle 180ms var(--ease-settle) both, cn-fade-terracotta 1600ms ease-out 400ms backwards; }
  .fresh td:first-child::before {
    content: ""; position: absolute; left: 0; top: 25%; bottom: 25%; width: 3px;
    background: var(--terracotta); border-radius: var(--radius-sm);
    animation: cn-fade-out 1600ms ease-out 1200ms both;
  }
  @media (prefers-reduced-motion: reduce) {
    .fresh { animation: cn-fade-terracotta 1600ms ease-out 400ms backwards; }
  }
</style>
