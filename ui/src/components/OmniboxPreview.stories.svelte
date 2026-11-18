<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import OmniboxPreview from "./OmniboxPreview.svelte";

  const { Story } = defineMeta({
    title: "Parts/OmniboxPreview", component: OmniboxPreview,
    args: {
      typed: "road",
      suggestions: [{ slug: "roadmap", description: "Product roadmap, 2027" }, { slug: "roadmap-archive", description: "Older plans" }],
    },
  });
</script>

<Story name="Typing go/road" />
