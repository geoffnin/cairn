<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { NOW, roadmapChanges } from "../stories/fixtures";
  import ChangeHistory from "./ChangeHistory.svelte";

  const { Story } = defineMeta({
    title: "Sections/ChangeHistory", component: ChangeHistory,
    args: { changes: roadmapChanges, created: { date: "2026-03-04", by: "maya@example.com" }, now: NOW },
  });
</script>

<Story name="Three changes" />
<Story name="One lit" args={{ active: 2 }} />
<Story name="Never changed" args={{ changes: [] }} />
