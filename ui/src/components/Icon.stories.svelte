<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Icon from "./Icon.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Icon", component: Icon, args: { name: "search", size: 16 },
    argTypes: { name: { control: "select", options: ["search", "check", "arrow", "chevron", "copy", "external"] } },
  });
</script>

<Story name="Search" />
<Story name="All">
  {#snippet template()}
    <div style="display: flex; gap: 16px; color: var(--ink)">
      {#each ["search", "check", "arrow", "chevron", "copy", "external"] as const as name (name)}<Icon {name} size={20} label={name} />{/each}
    </div>
  {/snippet}
</Story>
