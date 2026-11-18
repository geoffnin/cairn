<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import PopupLinkForm from "./PopupLinkForm.svelte";

  const { Story } = defineMeta({
    title: "Sections/PopupLinkForm", component: PopupLinkForm,
    args: { oncreate: fn(), onslugchange: fn(), onedittaken: fn(), url: "https://docs.example.com/planning/2026/q4-planning", title: "Q4 planning" },
  });
</script>

<Story name="Name free" args={{ slug: "q4", check: { state: "free" } }} />
<Story name="Checking" args={{ slug: "q4", check: { state: "checking" } }} />
<Story name="Offers pass-through for an ID" args={{ slug: "bug", url: "https://tracker.example.com/browse/ABC-12", title: "ABC-12: Fix login" }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Make ABC-12 a {*}" }));
    await expect(canvas.getByLabelText(/Destination/)).toHaveValue("https://tracker.example.com/browse/{*}");
    await expect(canvas.getByLabelText(/Destination/)).toHaveAccessibleDescription("bug/ABC-12 opens this page; bug/other opens …/browse/other.");
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    await expect(args.oncreate).toHaveBeenCalledWith({ slug: "bug", url: "https://tracker.example.com/browse/{*}", description: "ABC-12: Fix login" });
  }}
/>
<Story name="Create failed" args={{ slug: "q4", message: { text: "Cairn could not reach go.acme.com.", error: true } }} />
