<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import MakeLinkCard from "./MakeLinkCard.svelte";

  const { Story } = defineMeta({
    title: "Sections/MakeLinkCard", component: MakeLinkCard,
    args: { slug: "oncall-sre", create: fn(async (l) => l), oncreated: fn() },
  });
</script>

<Story name="Name filled in" play={async ({ args, canvas, userEvent }) => {
  const dest = canvas.getByLabelText("Destination");
  await expect(dest).toHaveFocus();
  await userEvent.type(dest, "https://pager.example.com/schedules/sre");
  await userEvent.click(canvas.getByRole("button", { name: "Create link and open it" }));
  await expect(args.create).toHaveBeenCalledWith({ slug: "oncall-sre", url: "https://pager.example.com/schedules/sre", description: "" });
  await expect(args.oncreated).toHaveBeenCalled();
}} />
<Story name="Creates without an oncreated listener" args={{ oncreated: undefined }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText("Destination"), "https://pager.example.com/schedules/sre");
  await userEvent.click(canvas.getByRole("button", { name: "Create link and open it" }));
  await expect(args.create).toHaveBeenCalledOnce();
}} />
<Story name="Create fails" args={{ create: fn(async () => { throw new Error("Enter a full address, starting with https://."); }) }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText("Destination"), "https://x.example.com");
    await userEvent.click(canvas.getByRole("button", { name: "Create link and open it" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("Enter a full address");
  }}
/>
