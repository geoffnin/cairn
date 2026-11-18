<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Button from "./Button.svelte";
  import Kbd from "./Kbd.svelte";

  const { Story } = defineMeta({ title: "Primitives/Kbd", component: Kbd, args: { keys: "Enter" } });
</script>

<Story name="One key" />
<Story name="Several keys" args={{ keys: ["j", "k"] }} />
<Story name="Inside a primary button">
  {#snippet template(args)}<Button variant="primary">New link <Kbd {...args} /></Button>{/snippet}
</Story>
