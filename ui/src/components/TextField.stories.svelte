<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import LinkButton from "./LinkButton.svelte";
  import TextField from "./TextField.svelte";

  const { Story } = defineMeta({
    title: "Primitives/TextField", component: TextField,
    args: { label: "Description", value: "" },
  });
</script>

<Story name="Plain" args={{ placeholder: "Q4 planning" }} />
<Story name="go/ name" args={{ label: "Name", go: true, value: "q4" }} play={async ({ canvas }) => {
  await expect(canvas.getByLabelText("Name")).toHaveValue("q4");
}} />
<Story name="Mono, with a note" args={{ label: "Destination", note: "· this tab", mono: true, value: "https://docs.example.com/…/q4-planning" }} />
<Story name="Hint" args={{ label: "Description", note: "(optional, helps people find it)", hint: "Shown in suggestions as people type." }} />
<Story name="Error" args={{ label: "Destination", mono: true, value: "docs", error: "Enter a full address, starting with https://." }}
  play={async ({ canvas }) => {
    const input = canvas.getByLabelText("Destination");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription("Enter a full address, starting with https://.");
  }}
/>
<Story name="Label action">
  {#snippet template(args)}
    <TextField {...args} label="Destination" note="· this tab" mono value="https://docs.example.com/rfcs/0042">
      {#snippet action()}<LinkButton>Make <code>0042</code> a <code>{"{*}"}</code></LinkButton>{/snippet}
    </TextField>
  {/snippet}
</Story>
