<!-- Every change to a link, newest first, numbered like the chart's markers: what changed, who
     changed it, before (struck through) and after. Ends with when it was made. Pointing at a row
     highlights its marker (`active`). -->
<script lang="ts">
  import type { LinkChange } from "../lib/usage";
  import { formatDate } from "../lib/format";
  import NumberBadge from "./NumberBadge.svelte";

  type Props = { changes: LinkChange[]; created?: { date: string; by: string }; active?: number | null; now?: Date };
  let { changes, created, active = $bindable(null), now = new Date() }: Props = $props();
  const id = $props.id();
</script>

<section class="history" aria-labelledby="{id}-h">
  <h2 id="{id}-h">History</h2>
  <ol>
    {#each changes as c (c.n)}
      <li class:on={c.n === active} onpointerenter={() => (active = c.n)} onpointerleave={() => (active = null)}>
        <NumberBadge value={c.n} tone="terracotta" label="Change {c.n}" />
        <div class="body">
          <p><span class="what">{c.what}</span> by {c.by}</p>
          {#if c.before !== undefined}<del><span class="cn-visually-hidden">Before: </span>{c.before}</del>{/if}
          {#if c.after !== undefined}<ins><span class="cn-visually-hidden">After: </span>{c.after}</ins>{/if}
        </div>
        <time datetime={c.date}>{formatDate(c.date, now)}</time>
      </li>
    {/each}
    {#if created}
      <li>
        <NumberBadge />
        <div class="body"><p><span class="what">Created</span> by {created.by}</p></div>
        <time datetime={created.date}>{formatDate(created.date, now)}</time>
      </li>
    {/if}
  </ol>
</section>

<style>
  .history { overflow: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
  h2 { padding: var(--pad) var(--pad) var(--space-4); font: var(--type-heading); border-bottom: 1px solid var(--line); }
  ol { margin: 0; padding: 0; list-style: none; }
  li {
    display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: var(--space-3); align-items: start;
    padding: var(--space-4) var(--pad); transition: background-color 120ms var(--ease-quick);
  }
  li + li { border-top: 1px solid var(--line); }
  li.on { background: var(--surface-sunken); }
  .body { display: grid; gap: var(--space-1); min-width: 0; }
  p { color: var(--ink-muted); }
  .what { font-weight: 500; color: var(--ink); }
  del, ins { display: block; font: var(--type-url); overflow-wrap: anywhere; text-decoration: none; }
  del { color: var(--ink-faint); text-decoration: line-through; }
  ins { color: var(--ink); }
  time { font: var(--type-small); color: var(--ink-muted); white-space: nowrap; }
</style>
