<!-- A small square with a number in it: a welcome step (moss when it is the current one, sunken
     when it is still to do, a check when done) or a change to a link (terracotta, so the chart's
     markers and the History rows match). An empty quiet badge holds a row's place. -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  type Props = {
    value?: string | number;
    tone?: "quiet" | "moss" | "terracotta";
    done?: boolean;
    /** Read out instead of the number, e.g. "Step 2". */
    label?: string;
  };
  let { value, tone = "quiet", done = false, label }: Props = $props();
</script>

<span class="badge {tone}" class:done role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
  {#if done}<Icon name="check" size={14} />{:else if value !== undefined}{value}{/if}
</span>

<style>
  .badge {
    display: inline-grid; place-items: center; flex: none;
    width: 20px; height: 20px; border-radius: var(--radius-sm);
    font: 600 11px/1 var(--font-sans); font-variant-numeric: tabular-nums;
  }
  .quiet { color: var(--ink-muted); background: var(--surface-sunken); }
  .done { color: var(--moss); }
  .moss { color: var(--on-moss); background: var(--moss); }
  .terracotta { color: var(--surface); background: var(--terracotta); }
</style>
