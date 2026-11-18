<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import WhereLinksLive from "./WhereLinksLive.svelte";

  const { Story } = defineMeta({ title: "Sections/WhereLinksLive", component: WhereLinksLive, args: { mode: "local", onchange: fn() } });
</script>

<Story name="This browser" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByLabelText("Your company’s server"));
  await expect(args.onchange).toHaveBeenCalledWith("shared");
}} />
<Story name="Company server" args={{ mode: "shared" }} />
