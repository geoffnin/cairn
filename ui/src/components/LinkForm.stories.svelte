<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";
  import LinkForm from "./LinkForm.svelte";

  const { Story } = defineMeta({ title: "Sections/LinkForm", component: LinkForm, args: { create: fn(async (l) => l) } });
</script>

<Story name="New link" />
<Story name="From an unknown name" args={{ slug: "oncall-sre", message: { text: "go/oncall-sre does not exist yet. Add a destination to create it." } }} />
