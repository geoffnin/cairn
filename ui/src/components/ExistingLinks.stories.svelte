<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import ExistingLinks from "./ExistingLinks.svelte";

  const dozen = ["rfc-42", "ownership-rfc", "link-ownership", "rfc-0042", "shared-links", "owners", "rfc-owners", "go-owners", "handover", "who-owns", "rfc-links", "ownership"]
    .map((slug) => ({ slug, url: "", description: "" }));

  const { Story } = defineMeta({
    title: "Parts/ExistingLinks", component: ExistingLinks,
    args: { links: [{ slug: "rfc-42", url: "https://docs.example.com/rfcs/0042", description: "RFC 0042" }], copy: fn(async () => {}) },
  });
</script>

<Story name="One" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
  await expect(args.copy).toHaveBeenCalledWith("go/rfc-42");
}} />
<Story name="Several" args={{ links: dozen.slice(0, 2) }} />
<Story name="A dozen" args={{ links: dozen }} play={async ({ canvas, userEvent }) => {
  await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
  const more = canvas.getByRole("button", { name: "Show all 12" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(more);
  await expect(canvas.getAllByRole("listitem")).toHaveLength(12);
  await expect(canvas.getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
}} />
