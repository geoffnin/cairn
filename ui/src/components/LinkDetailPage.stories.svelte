<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import { HOST, ME, NOW, roadmap, roadmapChanges } from "../stories/fixtures";
  import LinkDetailPage from "./LinkDetailPage.svelte";

  const { Story } = defineMeta({
    title: "Journeys/3c Server: one link",
    component: LinkDetailPage,
    parameters: { layout: "fullscreen" },
    args: {
      host: HOST, me: ME, link: roadmap, changes: roadmapChanges, now: NOW, createdBy: "maya@example.com",
      copy: fn(async () => {}), onedit: fn(), ondelete: fn(),
    },
  });
</script>

<Story name="What it is and how it changed" play={async ({ canvas }) => {
  await expect(canvas.getByRole("region", { name: "History" })).toBeVisible();
  await expect(canvas.queryByRole("slider")).toBeNull();
}} />
