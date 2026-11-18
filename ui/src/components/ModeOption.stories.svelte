<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import Button from "./Button.svelte";
  import TextField from "./TextField.svelte";
  import ModeOption from "./ModeOption.svelte";

  const { Story } = defineMeta({
    title: "Parts/ModeOption", component: ModeOption,
    args: { name: "mode", value: "local", group: "local", title: "This browser", onselect: fn() },
  });
</script>

<Story name="Chosen">
  {#snippet template(args)}
    <ModeOption {...args}>{#snippet body()}Private to you, in this Chrome profile. Works now, nothing to set up.{/snippet}</ModeOption>
  {/snippet}
</Story>
<Story name="Not chosen" args={{ value: "shared", title: "Your company's server" }}>
  {#snippet template(args)}
    <ModeOption {...args}>{#snippet body()}Everyone at work sees the same links.{/snippet}</ModeOption>
  {/snippet}
</Story>

<Story name="Whole card and independent controls" args={{ group: "shared" }} play={async ({ args, canvas, userEvent }) => {
  const radio = canvas.getByRole("radio", { name: "This browser" });
  // Hit the blank inset, outside the radio, title and description.
  const card = radio.closest(".mode")!;
  const bounds = card.getBoundingClientRect();
  const hit = document.elementFromPoint(bounds.right - 5, bounds.bottom - 5)!;
  await expect(hit.tagName).toBe("LABEL");
  await userEvent.click(hit);
  await expect(radio).toBeChecked();
  await expect(args.onselect).toHaveBeenCalledOnce();
  await userEvent.click(canvas.getByRole("button", { name: "Manage links" }));
  await userEvent.type(canvas.getByLabelText("Server URL"), "https://go.example.com");
  await expect(args.onselect).toHaveBeenCalledOnce();
}}>
  {#snippet template(args)}
    <ModeOption {...args}>
      {#snippet body()}Click anywhere on this card.{/snippet}
      {#snippet extra()}<Button>Manage links</Button><TextField label="Server URL" />{/snippet}
    </ModeOption>
  {/snippet}
</Story>
<Story name="Keyboard selection" args={{ group: "shared" }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.tab();
  await expect(canvas.getByRole("radio")).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect(canvas.getByRole("radio")).toBeChecked();
  await expect(args.onselect).toHaveBeenCalledOnce();
}} />
<Story name="Disabled" args={{ disabled: true, group: "shared" }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText("This browser"));
  await expect(canvas.getByRole("radio")).not.toBeChecked();
  await expect(args.onselect).not.toHaveBeenCalled();
}} />
