<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import CreatedLink from "./CreatedLink.svelte";

  const { Story } = defineMeta({
    title: "Parts/CreatedLink", component: CreatedLink,
    args: { link: { slug: "q4", url: "https://docs.example.com/planning/2026/q4-planning", description: "Q4 planning" } },
  });
</script>

<Story name="Just made" />
