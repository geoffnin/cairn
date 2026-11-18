<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import WhereLinksLive from "./WhereLinksLive.svelte";

  const { Story } = defineMeta({
    title: "Sections/WhereLinksLive", component: WhereLinksLive,
    args: { mode: "local", onchange: fn(), connect: fn(async () => {}) },
  });
</script>

<Story name="This browser" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText(/Everyone at work sees/));
  await expect(canvas.getByRole("radio", { name: "Your company’s server" })).toBeChecked();
  await expect(args.onchange).not.toHaveBeenCalled();
  await userEvent.type(canvas.getByLabelText("Server URL"), "https://go.example.com/");
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(args.connect).toHaveBeenCalledOnce();
  await expect(args.connect).toHaveBeenCalledWith("https://go.example.com");
  await expect(args.onchange).toHaveBeenCalledWith("shared");
  await expect(canvas.getByText("Using go.example.com.")).toBeVisible();
  await userEvent.click(canvas.getByText(/Private to you/));
  await expect(args.onchange).toHaveBeenLastCalledWith("local");
  await expect(canvas.queryByLabelText("Server URL")).not.toBeInTheDocument();
}} />
<Story name="Company server" args={{ mode: "shared", serverUrl: "https://go.example.com" }} />
<Story name="Invalid address and connection failure" args={{ connect: fn(async () => { throw new Error("Could not connect. Check the address and try again."); }) }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText("Your company’s server"));
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(canvas.getByText("Enter a full URL, like https://go.example.com")).toBeVisible();
  await expect(args.connect).not.toHaveBeenCalled();
  await userEvent.type(canvas.getByLabelText("Server URL"), "http://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(canvas.getByText("The server URL must use https://")).toBeVisible();
  await userEvent.clear(canvas.getByLabelText("Server URL"));
  await userEvent.type(canvas.getByLabelText("Server URL"), "https://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(canvas.getByText("Could not connect. Check the address and try again.")).toBeVisible();
  await expect(args.onchange).not.toHaveBeenCalled();
  await expect(canvas.getByRole("button", { name: "Use this server" })).toBeEnabled();
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(args.connect).toHaveBeenCalledTimes(2);
  await expect(args.onchange).not.toHaveBeenCalled();
  await userEvent.click(canvas.getByText("This browser"));
  await expect(args.onchange).toHaveBeenCalledWith("local");
  await expect(canvas.queryByLabelText("Server URL")).not.toBeInTheDocument();
}} />
<Story name="Connecting" args={{ connect: fn(() => new Promise<void>(() => {})) }} play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByText("Your company’s server"));
  await userEvent.type(canvas.getByLabelText("Server URL"), "https://go.example.com");
  await userEvent.click(canvas.getByRole("button", { name: "Use this server" }));
  await expect(canvas.getByRole("button", { name: "Connecting…" })).toBeDisabled();
  await expect(canvas.getByLabelText("Server URL")).toBeDisabled();
  for (const radio of canvas.getAllByRole("radio")) await expect(radio).toBeDisabled();
  await expect(args.onchange).not.toHaveBeenCalled();
}} />
