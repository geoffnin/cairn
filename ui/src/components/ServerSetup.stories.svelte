<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import ServerSetup from "./ServerSetup.svelte";
  const { Story } = defineMeta({
    title: "Sections/ServerSetup", component: ServerSetup,
    args: { saveServer: fn(async () => {}), authenticate: fn() },
  });
</script>

<Story name="Input action alignment" play={async ({ canvas, userEvent }) => {
  const input = canvas.getByLabelText("Server URL");
  const button = canvas.getByRole("button", { name: "Authenticate" });
  const aligned = async () => {
    const field = input.getBoundingClientRect();
    const action = button.getBoundingClientRect();
    // On narrow screens the button wraps below the input; otherwise their centers align.
    if (action.left >= field.right) await expect(Math.abs(field.top + field.height / 2 - action.top - action.height / 2)).toBeLessThan(1);
  };
  await aligned();
  await userEvent.type(input, "go.example.com");
  await userEvent.tab();
  await expect(canvas.getByText("Server address saved.")).toBeVisible();
  await userEvent.clear(input);
  await userEvent.type(input, "http://go.example.com");
  await userEvent.tab();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(canvas.queryByText("Server address saved.")).not.toBeInTheDocument();
  await aligned();
}} />
<Story name="Save failure" args={{ saveServer: fn(async () => { throw new Error("Could not save the address. Try again."); }) }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText("Server URL"), "go.example.com");
  await userEvent.tab();
  await expect(canvas.getByText("Could not save the address. Try again.")).toBeVisible();
  await expect(args.authenticate).not.toHaveBeenCalled();
}} />
<Story name="Permission refused" args={{ authenticate: fn(async () => { throw new Error("Allow access to this server, then try again."); }) }} play={async ({ canvas, userEvent }) => {
  await userEvent.type(canvas.getByLabelText("Server URL"), "go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Authenticate" }));
  await expect(canvas.getByText("Allow access to this server, then try again.")).toBeVisible();
  await expect(canvas.getByRole("button", { name: "Authenticate" })).toBeEnabled();
}} />
