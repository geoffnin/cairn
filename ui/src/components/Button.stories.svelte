<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import type { ComponentProps } from "svelte";
  import Button from "./Button.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Button",
    component: Button,
    args: { variant: "default", small: false, disabled: false, onclick: fn() },
    argTypes: { variant: { control: "inline-radio", options: ["default", "primary", "quiet", "danger"] } },
  });
</script>

{#snippet template({ children: _, ...args }: ComponentProps<typeof Button>)}
  <Button {...args}>{args.variant === "danger" ? "Delete" : args.variant === "primary" ? "Create link" : "Edit"}</Button>
{/snippet}

<Story name="Primary" args={{ variant: "primary" }} {template}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    await expect(args.onclick).toHaveBeenCalledOnce();
  }}
/>
<Story name="Default" {template} />
<Story name="Quiet" args={{ variant: "quiet" }} {template} />
<Story name="Danger" args={{ variant: "danger" }} {template} />
<Story name="Small" args={{ small: true }} {template} />
<Story name="Disabled" args={{ variant: "primary", disabled: true }} {template} />
<Story name="As a link" args={{ href: "#all" }} {template} />
