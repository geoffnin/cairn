<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { roadmapChanges, roadmapUses } from "../stories/fixtures";
  import UsageChart from "./UsageChart.svelte";

  const { Story } = defineMeta({
    title: "Parts/UsageChart", component: UsageChart,
    args: { days: roadmapUses.slice(-90), changes: roadmapChanges },
  });
</script>

<Story name="Last 90 days, with changes" play={async ({ canvas, userEvent }) => {
  const chart = canvas.getByRole("slider", { name: "Uses per day" });
  await userEvent.tab();
  await expect(chart).toHaveFocus();
  await userEvent.keyboard("{End}");
  await expect(chart).toHaveAttribute("aria-valuenow", "90");
  await expect(chart.getAttribute("aria-valuetext")).toMatch(/^Tue, Nov 17: \d+ uses$/);
  // Oct 22 is change 2: 26 days before Nov 17.
  for (let i = 0; i < 26; i++) await userEvent.keyboard("{ArrowLeft}");
  await expect(chart.getAttribute("aria-valuetext")).toMatch(/^Thu, Oct 22: \d+ uses\. Change 2: Description changed by lee@$/);
}} />
<Story name="Last 7 days" args={{ days: roadmapUses.slice(-7) }} />
<Story name="A change looked at" args={{ active: 2 }} />
<Story name="Two changes on one day"
  args={{
    days: roadmapUses.slice(-30),
    changes: [
      { n: 2, date: "2026-11-10", what: "Owner changed", by: "maya@", before: "maya@example.com", after: "lee@example.com" },
      { n: 1, date: "2026-11-10", what: "Description changed", by: "maya@", before: "Roadmap", after: "Product roadmap, 2027" },
    ],
    active: 2,
  }}
  play={async ({ canvas }) => {
    const value = canvas.getByRole("slider").getAttribute("aria-valuetext");
    await expect(value).toMatch(/Change 1: Description changed by maya@\. Change 2: Owner changed by maya@$/);
    await expect(canvas.getByText("2", { selector: ".marker text" })).toBeInTheDocument();
    await expect(canvas.getByText("1", { selector: ".marker text" })).toBeInTheDocument();
  }}
/>
<Story name="Empty range" args={{ days: [], changes: [] }} play={async ({ canvas }) => {
  await expect(canvas.queryByRole("slider")).toBeNull();
  await expect(canvas.getByText("No uses to show for this range.")).toBeVisible();
}} />
<Story name="No uses yet" args={{ days: roadmapUses.slice(-30).map((d) => ({ ...d, uses: 0 })), changes: [] }} />
