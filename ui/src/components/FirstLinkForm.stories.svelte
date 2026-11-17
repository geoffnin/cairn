<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import FirstLinkForm from "./FirstLinkForm.svelte";

  const { Story } = defineMeta({
    title: "Sections/FirstLinkForm", component: FirstLinkForm,
    args: { create: fn(async (l) => l), oncreated: fn(), onimport: fn() },
  });
</script>

<Story name="Empty" play={async ({ args, canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText("Name"), "roadmap");
  await userEvent.type(canvas.getByLabelText("Destination"), "https://docs.example.com/roadmap{Enter}");
  await expect(args.create).toHaveBeenCalledWith({ slug: "roadmap", url: "https://docs.example.com/roadmap", description: "" });
  await expect(await canvas.findByText(/Try it below/)).toBeVisible();
  await expect(args.oncreated).toHaveBeenCalled();
}} />
<Story name="Name taken" args={{ create: fn(async () => { throw new Error("go/roadmap already exists."); }) }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Name"), "roadmap");
    await userEvent.type(canvas.getByLabelText("Destination"), "https://docs.example.com/roadmap{Enter}");
    await expect(await canvas.findByRole("alert")).toHaveTextContent("roadmap already exists.");
  }}
/>
