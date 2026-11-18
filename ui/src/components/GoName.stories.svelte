<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import GoName from "./GoName.svelte";

  const { Story } = defineMeta({ title: "Primitives/GoName", component: GoName, args: { name: "roadmap" } });
</script>

<Story name="Plain" play={async ({ canvas }) => {
  // go/ comes from CSS, so copying the name yields the bare name.
  await expect(canvas.getByText("roadmap").textContent).toBe("roadmap");
}} />
<Story name="As a link" args={{ href: "#roadmap", title: "Product roadmap, 2027" }} />
<Story name="Large, in a heading">
  {#snippet template(args)}<h1 style="font: 500 26px/32px var(--font-mono)"><GoName {...args} /></h1>{/snippet}
</Story>
