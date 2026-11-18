<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import ExistingLinks from "./ExistingLinks.svelte";

  const { Story } = defineMeta({
    title: "Parts/ExistingLinks", component: ExistingLinks,
    args: { links: [{ slug: "rfc-42", url: "https://docs.example.com/rfcs/0042", description: "RFC 0042" }], copy: fn(async () => {}) },
  });
</script>

<Story name="One" play={async ({ args, canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole("button", { name: "Copy" }));
  await expect(args.copy).toHaveBeenCalledWith("go/rfc-42");
}} />
<Story name="Several" args={{ links: [{ slug: "rfc-42", url: "", description: "" }, { slug: "ownership-rfc", url: "", description: "" }] }} />
