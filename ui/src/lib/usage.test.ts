import { describe, expect, it } from "vitest";
import { chartModel, describeTrend, indexAtX, niceScale, windowTotals, type DailyUses } from "./usage";

function days(from: string, uses: number[]): DailyUses[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return uses.map((u, i) => ({ date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), uses: u }));
}

describe("usage", () => {
  it("totals a window and the one before it", () => {
    const d = days("2026-11-01", [1, 2, 3, 4, 5, 6]);
    expect(windowTotals(d, 3)).toEqual({ total: 15, previous: 6 });
    expect(windowTotals(d, 4)).toEqual({ total: 18, previous: null });
  });

  it("describes the trend", () => {
    expect(describeTrend(130, 100)).toBe("up 30%");
    expect(describeTrend(88, 100)).toBe("down 12%");
    expect(describeTrend(100, 100)).toBe("level");
    expect(describeTrend(5, null)).toBeNull();
    expect(describeTrend(5, 0)).toBeNull();
  });

  it("picks round axis maxima", () => {
    expect(niceScale(65)).toEqual({ max: 80, step: 20 });
    expect(niceScale(9)).toEqual({ max: 10, step: 2.5 });
    expect(niceScale(0)).toEqual({ max: 4, step: 1 });
  });

  it("lays out the chart: line, ticks and change markers", () => {
    const d = days("2026-09-28", Array.from({ length: 10 }, (_, i) => i * 10));
    const model = chartModel(d, [
      { n: 1, date: "2026-10-01", what: "Destination changed", by: "maya@" },
      { n: 2, date: "2026-12-01", what: "Out of range", by: "lee@" },
    ]);
    expect(model.points).toHaveLength(10);
    expect(model.points[0]).toMatchObject({ x: 36, y: 210 });
    expect(model.points[9]).toMatchObject({ x: 808, y: 20 + 190 * (1 - 90 / 100) });
    expect(model.line.startsWith("M36 210 L")).toBe(true);
    expect(model.area.endsWith("Z")).toBe(true);
    expect(model.yTicks.map((t) => t.label)).toEqual(["0", "25", "50", "75", "100"]);
    expect(model.xTicks.map((t) => t.label)).toEqual(["Sep 30", "Oct 7"]);
    expect(model.markers).toHaveLength(1);
    expect(model.markers[0]).toMatchObject({ index: 3 });
  });

  it("sets same-day change markers side by side", () => {
    const d = days("2026-10-01", [1, 2, 3]);
    const model = chartModel(d, [
      { n: 3, date: "2026-10-02", what: "Owner changed", by: "lee@" },
      { n: 2, date: "2026-10-02", what: "Description changed", by: "lee@" },
      { n: 1, date: "2026-10-01", what: "Destination changed", by: "maya@" },
    ]);
    expect(model.markers.map((m) => [m.change.n, m.index, m.slot])).toEqual([[1, 0, 0], [2, 1, 0], [3, 1, 1]]);
    expect(model.markers[1]!.x).toBe(model.markers[2]!.x);
  });

  it("marks month starts on long ranges", () => {
    const model = chartModel(days("2026-08-20", new Array(90).fill(1)));
    expect(model.xTicks.map((t) => t.label)).toEqual(["Sep 1", "Oct 1", "Nov 1"]);
  });

  it("finds the day under the pointer", () => {
    expect(indexAtX(36, 90)).toBe(0);
    expect(indexAtX(808, 90)).toBe(89);
    expect(indexAtX(9999, 90)).toBe(89);
    expect(indexAtX(422, 3)).toBe(1);
  });
});
