<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Destination from "./Destination.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Destination", component: Destination,
    args: { url: "https://docs.example.com/product/plans/roadmap-2027#q1" },
  });
</script>

<Story name="URL" />
<Story name="Not a web URL" args={{ url: "mailto:help@example.com" }} />
