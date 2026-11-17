// A link's usage over time and the changes made to it: the numbers behind the link page's
// "Uses per day" chart and its History. Pure functions, so the chart is only drawing.

/** Uses on one day. `date` is a UTC calendar day, "2026-10-22". */
export interface DailyUses {
  date: string;
  uses: number;
}

/** One change to a link, numbered in order so the chart and History can point at each other. */
export interface LinkChange {
  n: number;
  /** UTC calendar day, "2026-10-22". */
  date: string;
  /** "Destination changed", "Description changed", "Owner changed". */
  what: string;
  /** Who made it, as shown: "maya@". */
  by: string;
  before?: string;
  after?: string;
}

const DAY = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY);

/** The total of the last `n` days and of the `n` before them (null when the data is shorter). */
export function windowTotals(days: DailyUses[], n: number): { total: number; previous: number | null } {
  const sum = (from: number, to: number) => days.slice(Math.max(0, from), to).reduce((s, d) => s + d.uses, 0);
  const end = days.length;
  return { total: sum(end - n, end), previous: end >= 2 * n ? sum(end - 2 * n, end - n) : null };
}

/** "up 30%", "down 12%", "level" — how a total compares with the one before it. */
export function describeTrend(total: number, previous: number | null): string | null {
  if (previous === null) return null;
  if (previous === 0) return total === 0 ? "level" : null;
  const pct = Math.round(((total - previous) / previous) * 100);
  if (pct === 0) return "level";
  return pct > 0 ? `up ${pct}%` : `down ${-pct}%`;
}

/** A round axis maximum at or above `max`, split into `ticks` equal steps of 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (max <= 0) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return { max: step * ticks, step };
}

export interface ChartBox {
  width: number;
  height: number;
  /** The plot area inside the box. */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The link page's chart: an 816 × 240 box with room for the y labels and the x labels below. */
export const CHART_BOX: ChartBox = { width: 816, height: 240, left: 36, right: 808, top: 20, bottom: 210 };

export interface ChartPoint extends DailyUses {
  x: number;
  y: number;
}

export interface ChartModel {
  points: ChartPoint[];
  /** SVG path data for the line, and for the area under it. */
  line: string;
  area: string;
  yTicks: { y: number; label: string }[];
  xTicks: { x: number; label: string }[];
  /**
   * The changes that fall inside the range, at their day's x. Changes on the same day share the
   * line; `slot` (0, 1, …) sets their labels side by side, so each number stays visible.
   */
  markers: { x: number; index: number; slot: number; change: LinkChange }[];
}

const tickDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const round = (n: number) => Math.round(n * 10) / 10;

export function chartModel(days: DailyUses[], changes: LinkChange[] = [], box: ChartBox = CHART_BOX): ChartModel {
  const { max, step } = niceScale(Math.max(0, ...days.map((d) => d.uses)));
  const span = Math.max(1, days.length - 1);
  const x = (i: number) => round(box.left + ((box.right - box.left) * i) / span);
  const y = (v: number) => round(box.bottom - ((box.bottom - box.top) * v) / max);

  const points = days.map((d, i) => ({ ...d, x: x(i), y: y(d.uses) }));
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1)!.x} ${box.bottom} L${points[0]!.x} ${box.bottom} Z` : "";

  const yTicks = [];
  for (let v = 0; v <= max; v += step) yTicks.push({ y: y(v), label: String(v) });

  // A long range marks the first of each month; a short one, every seventh day back from today.
  const xTicks: ChartModel["xTicks"] = [];
  days.forEach((d, i) => {
    const label = tickDate.format(new Date(`${d.date}T00:00:00Z`));
    if (days.length > 45 ? d.date.endsWith("-01") : (days.length - 1 - i) % 7 === 0) xTicks.push({ x: x(i), label });
  });

  const first = days.length ? dayNumber(days[0]!.date) : 0;
  const markers = changes
    .map((change) => ({ change, index: dayNumber(change.date) - first }))
    .filter(({ index }) => index >= 0 && index < days.length)
    .sort((a, b) => a.index - b.index || a.change.n - b.change.n)
    .map(({ change, index }, i, all) => {
      let slot = 0;
      while (i - slot - 1 >= 0 && all[i - slot - 1]!.index === index) slot++;
      return { change, index, slot, x: x(index) };
    });

  return { points, line, area, yTicks, xTicks, markers };
}

/** The day nearest an x position in the chart box. */
export function indexAtX(x: number, count: number, box: ChartBox = CHART_BOX): number {
  if (count < 2) return 0;
  const i = Math.round(((x - box.left) / (box.right - box.left)) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}
