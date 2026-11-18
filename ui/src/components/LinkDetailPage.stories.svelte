<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, within } from "storybook/test";
  import { HOST, ME, NOW, roadmap, roadmapChanges, roadmapUses } from "../stories/fixtures";
  import LinkDetailPage from "./LinkDetailPage.svelte";

  const { Story } = defineMeta({
    title: "Journeys/3c Server: one link",
    component: LinkDetailPage,
    parameters: { layout: "fullscreen" },
    args: {
      host: HOST, me: ME, link: roadmap, uses: roadmapUses, changes: roadmapChanges, now: NOW,
      source: "Prometheus · cairn_redirects_total", createdBy: "maya@example.com",
      copy: fn(async () => {}), onedit: fn(), ondelete: fn(),
    },
  });
</script>

<Story name="Usage and change markers" />

<Story name="History and chart point at each other" play={async ({ canvas, userEvent }) => {
  const history = within(canvas.getByRole("region", { name: "History" }));
  const row = history.getByText("Description changed").closest("li")!;
  await userEvent.hover(row);
  await expect(row).toHaveClass("on");
  const chart = canvas.getByRole("slider");
  await expect(chart.getAttribute("aria-valuetext")).toMatch(/Oct 22.*Change 2/);
  await expect(canvasElement().querySelector(".marker.on text")).toHaveTextContent("2");
  await userEvent.unhover(row);
  await expect(row).not.toHaveClass("on");

  function canvasElement() {
    return chart.closest("main")!;
  }
}} />
