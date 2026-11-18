<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import WhereLinksLive from "./WhereLinksLive.svelte";

  const { Story } = defineMeta({
    title: "Sections/WhereLinksLive", component: WhereLinksLive,
    args: { mode: "local", onchange: fn(), saveServer: fn(async () => {}), authenticate: fn() },
  });
</script>

<Story name="This browser" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText(/Everyone at work sees/));
  await expect(canvas.getByRole("radio", { name: "Your company’s server" })).toBeChecked();
  await expect(args.onchange).not.toHaveBeenCalled();
  await userEvent.type(canvas.getByLabelText("Server URL"), "go.example.com/");
  await userEvent.tab();
  await expect(args.saveServer).toHaveBeenCalledWith("https://go.example.com");
  await expect(args.onchange).toHaveBeenCalledWith("shared");
  await expect(args.authenticate).not.toHaveBeenCalled();
  await expect(canvas.getByLabelText("Server URL")).toHaveValue("https://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Authenticate" }));
  await expect(args.authenticate).toHaveBeenCalledWith("https://go.example.com");
  await userEvent.click(canvas.getByText(/Private to you/));
  await expect(args.onchange).toHaveBeenLastCalledWith("local");
}} />
<Story name="Company server" args={{ mode: "shared", serverUrl: "https://go.example.com" }} />
<Story name="Local development" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText("Your company’s server"));
  await userEvent.type(canvas.getByLabelText("Server URL"), "localhost:1234/forward");
  await userEvent.tab();
  await expect(args.saveServer).toHaveBeenCalledWith("http://localhost:1234");
  await expect(canvas.getByLabelText("Server URL")).toHaveValue("http://localhost:1234");
  await userEvent.click(canvas.getByRole("button", { name: "Authenticate" }));
  await expect(args.authenticate).toHaveBeenCalledWith("http://localhost:1234");
}} />
<Story name="Invalid address" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText("Your company’s server"));
  await userEvent.type(canvas.getByLabelText("Server URL"), "http://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Authenticate" }));
  await expect(canvas.getByLabelText("Server URL")).toHaveAttribute("aria-invalid", "true");
  await expect(args.saveServer).not.toHaveBeenCalled();
  await expect(args.authenticate).not.toHaveBeenCalled();
  await expect(args.onchange).not.toHaveBeenCalled();
}} />
