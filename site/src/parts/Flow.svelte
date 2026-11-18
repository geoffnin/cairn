<!-- What happens between typing go/roadmap and landing on the page, as a row of stops (a column
     on narrow screens). Each stop says which piece does the work. -->
<script lang="ts">
  type Stop = { who: string; what: string; detail: string };
  let { stops }: { stops: Stop[] } = $props();
</script>

<ol class="flow">
  {#each stops as stop, i (stop.what)}
    <li>
      <span class="who">{stop.who}</span>
      <strong>{stop.what}</strong>
      <span class="detail">{stop.detail}</span>
      {#if i < stops.length - 1}<span class="arrow" aria-hidden="true"></span>{/if}
    </li>
  {/each}
</ol>

<style>
  .flow {
    list-style: none; margin: 0; padding: 0;
    display: grid; gap: var(--space-4); grid-template-columns: 1fr;
  }
  @media (min-width: 880px) { .flow { grid-template-columns: repeat(var(--n, 4), 1fr); gap: var(--space-6); } }
  li {
    position: relative; display: grid; gap: 6px; align-content: start;
    padding: var(--space-5); background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
  }
  .who { font: 500 12px/16px var(--font-mono); color: var(--terracotta); }
  strong { font: var(--s-h3); font-family: var(--font-mono); font-size: 16px; font-weight: 500; }
  .detail { color: var(--ink-muted); font-size: 14px; line-height: 1.55; }
  .arrow { position: absolute; display: none; }
  @media (min-width: 880px) {
    .arrow {
      display: block; top: 50%; right: calc(-1 * var(--space-6) + 6px); width: calc(var(--space-6) - 12px); height: 1px;
      background: var(--line-control);
    }
    .arrow::after {
      content: ""; position: absolute; right: 0; top: -3px; width: 7px; height: 7px;
      border-top: 1px solid var(--line-control); border-right: 1px solid var(--line-control); transform: rotate(45deg);
    }
  }
</style>
