<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import NameTaken from "./NameTaken.svelte";

  const { Story } = defineMeta({
    title: "Parts/NameTaken", component: NameTaken,
    args: {
      link: { slug: "bug", url: "https://tracker.example.com/browse/{*}", description: "Open a ticket by key" },
      alternative: "bug-tracker", onedit: fn(), onuse: fn(),
    },
  });
</script>

<Story name="With ways on" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Use go/bug-tracker" }));
  await expect(args.onuse).toHaveBeenCalledWith("bug-tracker");
  await userEvent.click(canvas.getByRole("button", { name: "Edit go/bug" }));
  await expect(args.onedit).toHaveBeenCalled();
}} />
<Story name="Someone else's, no alternative" args={{ link: { slug: "bug", url: "https://tracker.example.com/browse/{*}", description: "", can_edit: false }, alternative: undefined }} />
