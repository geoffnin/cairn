<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import LinkButton from "./LinkButton.svelte";

  const { Story } = defineMeta({ title: "Primitives/LinkButton", component: LinkButton, args: { onclick: fn() } });
</script>

<Story name="Action" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Skip for now" }));
  await expect(args.onclick).toHaveBeenCalled();
}}>
  {#snippet template(args)}<LinkButton onclick={args.onclick}>Skip for now</LinkButton>{/snippet}
</Story>
<Story name="Muted">
  {#snippet template(args)}<LinkButton onclick={args.onclick} muted>Settings</LinkButton>{/snippet}
</Story>
<Story name="Disabled, with href" play={async ({ canvas }) => {
  await expect(canvas.queryByRole("link")).toBeNull();
  await expect(canvas.getByRole("button", { name: "See your links" })).toBeDisabled();
}}>
  {#snippet template()}<LinkButton href="#links" disabled>See your links</LinkButton>{/snippet}
</Story>
<Story name="As a link">
  {#snippet template()}<LinkButton href="#links">See your links</LinkButton>{/snippet}
</Story>
