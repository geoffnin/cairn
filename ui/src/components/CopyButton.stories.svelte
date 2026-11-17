<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import CopyButton from "./CopyButton.svelte";

  const { Story } = defineMeta({
    title: "Primitives/CopyButton", component: CopyButton,
    args: { text: "go/rfc-42", copy: fn(async () => {}), oncopied: fn() },
  });
</script>

<Story name="Small" args={{ small: true }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
  await expect(args.copy).toHaveBeenCalledWith("go/rfc-42");
  await expect(await canvas.findByRole("button", { name: "Copied" })).toBeVisible();
  await expect(canvas.getByRole("status")).toHaveTextContent("Copied go/rfc-42");
}} />
<Story name="Primary, with shortcut" args={{ variant: "primary", label: "Copy link", keys: "⌘C", text: "http://go/q4" }} />
<Story name="Clipboard refused" args={{ copy: fn(async () => { throw new Error("denied"); }) }} play={async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
  await expect(await canvas.findByRole("button", { name: "Couldn’t copy" })).toBeVisible();
}} />
