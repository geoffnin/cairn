<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Notice from "./Notice.svelte";

  const { Story } = defineMeta({ title: "Parts/Notice", component: Notice, args: { tone: "error" } });
</script>

<Story name="Error">
  {#snippet template(args)}<Notice tone={args.tone}><p>That address is not reachable.</p></Notice>{/snippet}
</Story>
<Story name="Fresh" args={{ tone: "fresh" }}>
  {#snippet template(args)}<Notice tone={args.tone}><p>Just set down.</p></Notice>{/snippet}
</Story>
