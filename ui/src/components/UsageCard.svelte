<!-- A link's usage: the last 30 days' total against the 30 before, then the daily chart over the
     chosen range with changes marked. `source` names where the numbers come from. -->
<script lang="ts">
  import { formatCount } from "../lib/format";
  import { describeTrend, windowTotals, type DailyUses, type LinkChange } from "../lib/usage";
  import Segmented from "./Segmented.svelte";
  import UsageChart from "./UsageChart.svelte";

  type Props = {
    days: DailyUses[];
    changes?: LinkChange[];
    range?: "7" | "30" | "90";
    active?: number | null;
    source?: string;
  };
  let { days, changes = [], range = $bindable("90"), active = $bindable(null), source }: Props = $props();
  const id = $props.id();
  const totals = $derived(windowTotals(days, 30));
  const trend = $derived(describeTrend(totals.total, totals.previous));
  const shownDays = $derived(days.slice(-Number(range)));
</script>

<section class="usage" aria-labelledby="{id}-h">
  <div class="head">
    <div>
      <h2 id="{id}-h">Uses per day</h2>
      <p class="total"><strong>{formatCount(totals.total)}</strong> in the last 30 days{#if trend}, {trend} on the 30 before{/if}</p>
    </div>
    <Segmented label="Time range" bind:value={range} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
  </div>
  <UsageChart days={shownDays} {changes} bind:active label="Uses per day, last {range} days" />
  <div class="foot">
    <span class="legend"><span class="dash" aria-hidden="true"></span>Numbered lines mark changes to the link</span>
    {#if source}<code class="source">from {source}</code>{/if}
  </div>
</section>

<style>
  .usage { display: grid; gap: var(--space-4); padding: var(--pad); background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }
  .head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
  h2 { font: var(--type-heading); }
  .total { margin-top: var(--space-1); font: var(--type-small); color: var(--ink-muted); }
  .total strong { margin-right: var(--space-2); font: 600 22px/28px var(--font-sans); color: var(--ink); font-variant-numeric: tabular-nums; }
  .foot { display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); font: var(--type-small); color: var(--ink-muted); }
  .legend { display: inline-flex; align-items: center; gap: var(--space-2); }
  .dash { width: 0; height: 12px; border-left: 1px dashed var(--ink-muted); }
  .source { font-size: 11px; }
</style>
