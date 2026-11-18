<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { ComponentProps } from "svelte";
  import LinkButton from "./LinkButton.svelte";
  import Step from "./Step.svelte";

  const { Story } = defineMeta({
    title: "Parts/Step", component: Step, args: { n: 2, title: "Make your first link", state: "current" },
    argTypes: { state: { control: "inline-radio", options: ["todo", "current", "done"] } },
  });
</script>

{#snippet template(args: Omit<ComponentProps<typeof Step>, "children">)}
  <Step {...args}>
    {#snippet aside()}<LinkButton muted>Skip for now</LinkButton>{/snippet}
    <p>The step's content.</p>
  </Step>
{/snippet}

<Story name="Current" {template} />
<Story name="To do" args={{ state: "todo", n: 3, title: "Try it" }} {template} />
<Story name="Done" args={{ state: "done", n: 1, title: "Where your links live" }} {template} />
