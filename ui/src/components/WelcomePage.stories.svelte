<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, within } from "storybook/test";
  import WelcomePage from "./WelcomePage.svelte";

  const { Story } = defineMeta({
    title: "Journeys/1 Welcome tab",
    component: WelcomePage,
    parameters: { layout: "fullscreen" },
    args: { connect: fn(async () => {}), create: fn(async (l) => l), onmodechange: fn(), onimport: fn() },
  });
</script>

<Story name="Just installed" />

<Story name="Make the first link, then try it" play={async ({ args, canvas, userEvent }) => {
  const step2 = within(canvas.getByRole("region", { name: "Make your first link" }));
  await expect(step2.getByRole("img", { name: "Step 2, current" })).toBeVisible();
  await userEvent.type(step2.getByLabelText("Name"), "wiki");
  await userEvent.type(step2.getByLabelText("Destination"), "https://wiki.example.com/");
  await userEvent.click(step2.getByRole("button", { name: "Create link" }));
  await expect(args.create).toHaveBeenCalledOnce();
  await expect(await step2.findByRole("img", { name: "Step 2, done" })).toBeVisible();
  const step3 = within(canvas.getByRole("region", { name: "Try it" }));
  await expect(step3.getByRole("img", { name: "Step 3, current" })).toBeVisible();
  await expect(step3.getByText("wiki", { selector: ".go" })).toBeVisible();
}} />

<Story name="Skip the first link" play={async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Skip for now" }));
  await expect(canvas.getByRole("img", { name: "Step 3, current" })).toBeVisible();
}} />

<Story name="Configure a company server" play={async ({ args, canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText("Name"), "wiki");
  await userEvent.click(canvas.getByText(/Everyone at work sees/));
  await expect(canvas.getByRole("img", { name: "Step 1, current" })).toBeVisible();
  await expect(canvas.queryByRole("button", { name: "Create link" })).not.toBeInTheDocument();
  await userEvent.type(canvas.getByLabelText("Server URL"), "https://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(args.connect).toHaveBeenCalledWith("https://go.example.com");
  await expect(canvas.getByRole("img", { name: "Step 1, done" })).toBeVisible();
  await expect(canvas.getByRole("img", { name: "Step 2, current" })).toBeVisible();
  await expect(canvas.getByRole("button", { name: "Create link" })).toBeEnabled();
  await expect(canvas.getByLabelText("Name")).toHaveValue("wiki");
}} />
