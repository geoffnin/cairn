<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import { directory } from "../stories/fixtures";
  import LinkForm from "./LinkForm.svelte";

  const { Story } = defineMeta({ title: "Sections/LinkForm", component: LinkForm, args: { create: fn(async (l) => l) } });
</script>

<Story name="New link" />
<Story name="Checking the name" args={{ slug: "oncall-sre", check: { state: "checking" } }} />
<Story name="Name free" args={{ slug: "oncall-sre", check: { state: "free" } }} play={async ({ canvas }) => {
  await expect(canvas.getByText("go/oncall-sre is free")).toHaveAttribute("role", "status");
}} />
<Story name="Name taken" args={{ slug: "bug", url: "https://other.example.com", check: { state: "taken", link: directory[1]! } }}
  play={async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByLabelText("Name")).toHaveAccessibleDescription("go/bug already exists.");
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    await expect(args.create).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText("Name")).toHaveFocus();
  }}
/>
