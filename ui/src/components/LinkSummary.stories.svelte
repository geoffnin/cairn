<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import { NOW, roadmap } from "../stories/fixtures";
  import LinkSummary from "./LinkSummary.svelte";

  const { Story } = defineMeta({
    title: "Sections/LinkSummary", component: LinkSummary,
    args: { link: roadmap, now: NOW, copy: fn(async () => {}), onedit: fn(), ondelete: fn() },
  });
</script>

<Story name="Owner's view" play={async ({ args, canvas, userEvent }) => {
  await expect(canvas.getByText("4 minutes ago")).toBeVisible();
  await expect(canvas.getByText("Mar 4, 2026")).toBeVisible();
  await userEvent.click(canvas.getByRole("button", { name: "Copy link" }));
  await expect(args.copy).toHaveBeenCalledWith("http://go/roadmap");
  await userEvent.click(canvas.getByRole("button", { name: "Delete" }));
  await expect(args.ondelete).toHaveBeenCalled();
}} />
<Story name="Someone else's" args={{ link: { ...roadmap, can_edit: false } }} play={async ({ canvas }) => {
  await expect(canvas.queryByRole("button", { name: "Edit" })).toBeNull();
}} />
