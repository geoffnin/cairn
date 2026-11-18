<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Checkbox from "./Checkbox.svelte";

  const { Story } = defineMeta({ title: "Primitives/Checkbox", component: Checkbox, args: { label: "Only mine", checked: false } });
</script>

<Story name="Off" />
<Story name="On" args={{ checked: true }} />
