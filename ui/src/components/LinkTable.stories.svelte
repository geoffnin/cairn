<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";
  import { directory } from "../stories/fixtures";
  import LinkTable from "./LinkTable.svelte";

  const { Story } = defineMeta({
    title: "Sections/LinkTable", component: LinkTable,
    args: { links: directory, href: (l: { slug: string }) => `#/${l.slug}`, onedit: fn(), ondelete: fn() },
  });
</script>

<Story name="This browser" />
<Story name="Shared server" args={{ shared: true }} />
<Story name="Empty" args={{ links: [] }} />
