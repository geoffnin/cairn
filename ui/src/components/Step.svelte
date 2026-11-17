<!-- One numbered step of a setup page. `done` shows a check; `current` takes a moss border and a
     moss number, so the page shows where to look next. `aside` sits at the heading's end. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import NumberBadge from "./NumberBadge.svelte";

  type Props = { n: number; title: string; state?: "todo" | "current" | "done"; aside?: Snippet; children: Snippet };
  let { n, title, state = "todo", aside, children }: Props = $props();
  const id = $props.id();
  const said = $derived(state === "done" ? `Step ${n}, done` : state === "current" ? `Step ${n}, current` : `Step ${n}`);
</script>

<section class="step {state}" aria-labelledby="{id}-title">
  <div class="head">
    <NumberBadge value={n} done={state === "done"} tone={state === "current" ? "moss" : "quiet"} label={said} />
    <h2 id="{id}-title">{title}</h2>
    {#if aside}<span class="aside">{@render aside()}</span>{/if}
  </div>
  {@render children()}
</section>

<style>
  .step {
    display: grid; gap: var(--space-4); padding: var(--pad);
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }
  .current { border: 2px solid var(--moss); padding: calc(var(--pad) - 1px); }
  .head { display: flex; align-items: center; gap: var(--space-3); }
  h2 { font: var(--type-heading); }
  .aside { margin-left: auto; font: var(--type-small); color: var(--ink-muted); }
</style>
