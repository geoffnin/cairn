<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Tag from "./Tag.svelte";

  const { Story } = defineMeta({ title: "Primitives/Tag", component: Tag, args: { label: "local", title: "Saved in this browser only" } });
</script>

<Story name="Local" />
<Story name="Remote" args={{ label: "remote", title: "Shared on go.acme.com" }} />
