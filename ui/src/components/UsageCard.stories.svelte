<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { roadmapChanges, roadmapUses } from "../stories/fixtures";
  import UsageCard from "./UsageCard.svelte";

  const { Story } = defineMeta({
    title: "Sections/UsageCard", component: UsageCard,
    args: { days: roadmapUses, changes: roadmapChanges, source: "Prometheus · cairn_redirects_total" },
  });
</script>

<Story name="Last 90 days" play={async ({ canvas, userEvent }) => {
  await expect(canvas.getByText(/in the last 30 days, (up|down) \d+% on the 30 before/)).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "7 days" }));
  await expect(canvas.getByRole("slider")).toHaveAttribute("aria-valuemax", "7");
}} />
<Story name="New link, no history to compare" args={{ days: roadmapUses.slice(-20), changes: [], source: undefined }} />
