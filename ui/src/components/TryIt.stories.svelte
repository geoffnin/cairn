<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import TryIt from "./TryIt.svelte";

  const { Story } = defineMeta({ title: "Sections/TryIt", component: TryIt, args: { example: "roadmap" } });
</script>

<Story name="Default" />
