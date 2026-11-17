<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Mark from "./Mark.svelte";

  const { Story } = defineMeta({ title: "Primitives/Mark", component: Mark, args: { size: 40 } });
</script>

<Story name="Default" />
<Story name="Header size" args={{ size: 22 }} />
