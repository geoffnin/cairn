<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Account from "./Account.svelte";
  import Header from "./Header.svelte";

  const { Story } = defineMeta({ title: "Parts/Header", component: Header });
</script>

<Story name="Server">
  {#snippet template()}
    <Header>
      {#snippet hint()}<code>go.example.com</code>{/snippet}
      {#snippet end()}<Account email="dev@example.com" />{/snippet}
    </Header>
  {/snippet}
</Story>
<Story name="Extension">
  {#snippet template()}<Header>{#snippet end()}<a href="#settings">Settings</a>{/snippet}</Header>{/snippet}
</Story>
