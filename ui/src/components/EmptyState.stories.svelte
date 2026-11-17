<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import EmptyState from "./EmptyState.svelte";

  const { Story } = defineMeta({ title: "Parts/EmptyState", component: EmptyState });
</script>

<Story name="No links yet" />
<Story name="No results" args={{ query: "roadmap" }} />
<Story name="Only mine, none" args={{ filtered: true }} />
