<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import ModeOption from "./ModeOption.svelte";

  const { Story } = defineMeta({
    title: "Parts/ModeOption", component: ModeOption,
    args: { name: "mode", value: "local", group: "local", title: "This browser" },
  });
</script>

<Story name="Chosen">
  {#snippet template(args)}
    <ModeOption {...args}>{#snippet body()}Private to you, in this Chrome profile. Works now, nothing to set up.{/snippet}</ModeOption>
  {/snippet}
</Story>
<Story name="Not chosen" args={{ value: "shared", title: "Your company's server" }}>
  {#snippet template(args)}
    <ModeOption {...args}>{#snippet body()}Everyone at work sees the same links.{/snippet}</ModeOption>
  {/snippet}
</Story>
