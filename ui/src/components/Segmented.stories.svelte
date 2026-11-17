<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import Segmented from "./Segmented.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Segmented", component: Segmented,
    args: {
      label: "Show", value: "all", onchange: fn(),
      options: [{ value: "all", label: "All", count: 214 }, { value: "mine", label: "Mine", count: 12 }, { value: "new", label: "New this week", count: 5 }],
    },
  });
</script>

<Story name="Filter with counts" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: /Mine/ }));
  await expect(args.onchange).toHaveBeenCalledWith("mine");
  await expect(canvas.getByRole("button", { name: /Mine/ })).toHaveAttribute("aria-pressed", "true");
}} />
<Story name="Range" args={{ label: "Time range", value: "90", options: [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }] }} />
