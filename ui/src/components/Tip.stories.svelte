<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Kbd from "./Kbd.svelte";
  import Tip from "./Tip.svelte";

  const { Story } = defineMeta({ title: "Parts/Tip", component: Tip, args: { title: "Search your links" } });
</script>

<Story name="With keys">
  {#snippet template(args)}
    <Tip title={args.title}>
      {#snippet demo()}<Kbd keys={["go", "Space"]} /> <code>road…</code>{/snippet}
      Suggestions show the name and its description.
    </Tip>
  {/snippet}
</Story>
