<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Breadcrumb from "./Breadcrumb.svelte";

  const { Story } = defineMeta({ title: "Primitives/Breadcrumb", component: Breadcrumb, args: { trail: [{ label: "All links", href: "#all" }], current: "roadmap" } });
</script>

<Story name="Link page" />
