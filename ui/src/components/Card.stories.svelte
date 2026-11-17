<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Card from "./Card.svelte";

  const { Story } = defineMeta({ title: "Parts/Card", component: Card, args: { title: "New link" } });
</script>

<Story name="With title">
  {#snippet template(args)}<Card title={args.title}><p>Cards are flat: a hairline and the barest shadow.</p></Card>{/snippet}
</Story>
