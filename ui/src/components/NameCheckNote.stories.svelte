<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import NameCheckNote from "./NameCheckNote.svelte";

  const { Story } = defineMeta({ title: "Parts/NameCheckNote", component: NameCheckNote, args: { slug: "q4", check: { state: "free" } } });
</script>

<Story name="Free" />
<Story name="Checking" args={{ check: { state: "checking" } }} />
