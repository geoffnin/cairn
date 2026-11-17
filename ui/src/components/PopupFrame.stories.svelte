<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Frame from "../stories/Frame.svelte";
  import PopupFrame from "./PopupFrame.svelte";

  const { Story } = defineMeta({
    title: "Parts/PopupFrame", component: PopupFrame,
    args: { title: "New go link", where: { local: true }, links: [{ label: "All links", href: "#all" }, { label: "Settings", href: "#settings" }] },
  });
</script>

<Story name="Local">
  {#snippet template(args)}<Frame><PopupFrame {...args}><p>The state's content.</p></PopupFrame></Frame>{/snippet}
</Story>
<Story name="Remote" args={{ where: { server: "go.acme.com" } }}>
  {#snippet template(args)}<Frame><PopupFrame {...args}><p>The state's content.</p></PopupFrame></Frame>{/snippet}
</Story>
