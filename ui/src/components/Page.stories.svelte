<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Card from "./Card.svelte";
  import Header from "./Header.svelte";
  import Page from "./Page.svelte";

  const { Story } = defineMeta({ title: "Parts/Page", component: Page, parameters: { layout: "fullscreen" } });
</script>

<Story name="With the topographic footer">
  {#snippet template()}
    <Page><Header /><Card title="Content"><p>One column, centred, ending in contour lines.</p></Card></Page>
  {/snippet}
</Story>
