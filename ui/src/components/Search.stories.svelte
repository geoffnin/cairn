<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent as ue } from "storybook/test";
  import Search from "./Search.svelte";

  const { Story } = defineMeta({ title: "Primitives/Search", component: Search, args: { label: "Search names, URLs and descriptions" } });
</script>

<Story name="In a card" />
<Story name="Prominent" args={{ label: "Search links", placeholder: "Search 214 links by name, destination or description", prominent: true }}
  play={async ({ canvas }) => {
    const input = canvas.getByRole("searchbox", { name: "Search links" });
    await ue.keyboard("/");
    await expect(input).toHaveFocus();
    await ue.keyboard("road");
    await expect(input).toHaveValue("road");
    await ue.keyboard("{Escape}");
    await expect(input).toHaveValue("");
    await expect(input).not.toHaveFocus();
  }}
/>
