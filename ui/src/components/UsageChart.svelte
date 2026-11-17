<!-- Uses per day as a line, with each change to the link as a numbered terracotta marker, so a
     jump or a drop can be read against what changed. Pointing at the chart, or focusing it and
     using the arrow keys, reads out a day (and its change). `active` is the change being looked
     at, shared with the History list: pointing at a change in either highlights it in both. -->
<script lang="ts">
  import { formatCount, formatDay } from "../lib/format";
  import { CHART_BOX as box, chartModel, indexAtX, type DailyUses, type LinkChange } from "../lib/usage";

  type Props = {
    days: DailyUses[];
    changes?: LinkChange[];
    /** The change being looked at (its number), or null. */
    active?: number | null;
    label?: string;
  };
  let { days, changes = [], active = $bindable(null), label = "Uses per day" }: Props = $props();

  const model = $derived(chartModel(days, changes));
  let hover = $state<number | null>(null);
  const markerAt = (i: number) => model.markers.find((m) => m.index === i);
  // The day shown: the one pointed at, else the active change's day.
  const shown = $derived(hover ?? model.markers.find((m) => m.change.n === active)?.index ?? null);
  const point = $derived(shown === null ? null : model.points[shown]);
  const change = $derived(shown === null ? undefined : markerAt(shown)?.change);
  const valueText = $derived(
    point ? `${formatDay(point.date)}: ${formatCount(point.uses)} uses${change ? `. Change ${change.n}: ${change.what} by ${change.by}` : ""}` : "No day chosen",
  );

  function look(i: number | null) {
    hover = i;
    active = i === null ? null : (markerAt(i)?.change.n ?? null);
  }
  function onpointermove(e: PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    look(indexAtX(((e.clientX - rect.left) / rect.width) * box.width, days.length));
  }
  function onkeydown(e: KeyboardEvent) {
    const last = days.length - 1;
    const from = shown ?? last;
    const next = { ArrowLeft: from - 1, ArrowRight: from + 1, Home: 0, End: last, PageUp: from - 7, PageDown: from + 7 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    look(Math.min(last, Math.max(0, next)));
  }
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
</script>

<div
  class="plot" role="slider" tabindex="0" aria-label={label}
  aria-valuemin={1} aria-valuemax={days.length} aria-valuenow={(shown ?? days.length - 1) + 1} aria-valuetext={valueText}
  {onpointermove} onpointerleave={() => look(null)} {onkeydown} onblur={() => look(null)}
>
  <svg viewBox="0 0 {box.width} {box.height}" aria-hidden="true">
    <g class="grid">
      {#each model.yTicks as t (t.label)}
        <line x1={box.left} x2={box.right} y1={t.y} y2={t.y} class:base={t.label === "0"} />
        <text x={box.left - 8} y={t.y + 4} text-anchor="end">{t.label}</text>
      {/each}
      {#each model.xTicks as t (t.label)}<text x={t.x} y={box.height - 8} text-anchor="middle">{t.label}</text>{/each}
    </g>
    <path class="area" d={model.area} />
    <path class="line" d={model.line} />
    {#each model.markers as m (m.change.n)}
      <g class="marker" class:on={m.change.n === active}>
        <line x1={m.x} x2={m.x} y1={box.top} y2={box.bottom} />
        <rect x={m.x - 7} y={0} width="14" height="14" rx="3" />
        <text x={m.x} y={11} text-anchor="middle">{m.change.n}</text>
      </g>
    {/each}
    {#if point}
      <g class="hover">
        <line x1={point.x} x2={point.x} y1={box.top} y2={box.bottom} />
        <circle cx={point.x} cy={point.y} r="6" class="halo" />
        <circle cx={point.x} cy={point.y} r="4" class="dot" />
      </g>
    {/if}
  </svg>
  {#if point}
    <div class="tip" class:flip={point.x > box.width * 0.7} style:left={pct(point.x, box.width)} style:top={pct(Math.min(point.y, box.bottom - 40), box.height)} aria-hidden="true">
      <div class="tip-head"><strong>{formatDay(point.date)}</strong><span>{formatCount(point.uses)} uses</span></div>
      {#if change}<div class="tip-change"><span class="n">{change.n}</span>{change.what} by {change.by}</div>{/if}
    </div>
  {/if}
</div>

<style>
  .plot { position: relative; touch-action: pan-y; border-radius: var(--radius-md); }
  svg { display: block; width: 100%; height: auto; overflow: visible; font-family: var(--font-sans); }
  .grid line { stroke: var(--line); stroke-width: 1; }
  .grid line.base { stroke: var(--line-control); }
  .grid text { fill: var(--ink-faint); font-size: 11px; }
  .area { fill: var(--moss-soft); opacity: .8; }
  .line { fill: none; stroke: var(--moss); stroke-width: 1.5; stroke-linejoin: round; }
  .marker line { stroke: var(--ink-muted); stroke-width: 1; stroke-dasharray: 2 3; }
  .marker rect { fill: var(--terracotta); }
  .marker text { fill: var(--surface); font-size: 10px; font-weight: 600; }
  .marker.on line { stroke: var(--terracotta); stroke-dasharray: none; }
  .hover line { stroke: var(--ink-faint); stroke-width: 1; }
  .halo { fill: var(--surface); }
  .dot { fill: var(--moss); }
  .tip {
    position: absolute; z-index: 1; min-width: 200px; margin: -12px 0 0 12px; transform: translateY(-100%);
    padding: var(--space-2) var(--space-3); display: grid; gap: var(--space-2);
    font: var(--type-small); color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-menu);
    pointer-events: none;
  }
  .tip.flip { margin-left: -12px; transform: translate(-100%, -100%); }
  .tip-head { display: flex; justify-content: space-between; gap: var(--space-4); }
  .tip-head strong { font-weight: 600; }
  .tip-change { display: flex; align-items: center; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--line); color: var(--ink-muted); }
  .n { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 3px; font-size: 10px; font-weight: 600; color: var(--surface); background: var(--terracotta); }
</style>
