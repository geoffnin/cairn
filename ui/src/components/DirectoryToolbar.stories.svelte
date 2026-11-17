<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import DirectoryToolbar from "./DirectoryToolbar.svelte";

  const { Story } = defineMeta({
    title: "Sections/DirectoryToolbar", component: DirectoryToolbar,
    args: { counts: { all: 214, mine: 12, new: 5 }, onnew: fn(), onfilter: fn(), onsort: fn() },
  });
</script>

<Story name="Default" play={async ({ args, canvas, userEvent }) => {
  await expect(canvas.getByPlaceholderText("Search 214 links by name, destination or description")).toBeVisible();
  await userEvent.keyboard("c");
  await expect(args.onnew).toHaveBeenCalledOnce();
  await userEvent.click(canvas.getByRole("button", { name: /New this week/ }));
  await expect(args.onfilter).toHaveBeenCalledWith("new");
  await userEvent.selectOptions(canvas.getByLabelText("Sort"), "Name");
  await expect(args.onsort).toHaveBeenCalledWith("name");
}} />
