<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import KeyHints from "./KeyHints.svelte";

  const { Story } = defineMeta({
    title: "Parts/KeyHints", component: KeyHints,
    args: { hints: [{ keys: ["j", "k"], label: "move" }, { keys: ["Enter"], label: "open" }, { keys: ["y"], label: "copy" }, { keys: ["e"], label: "edit" }] },
  });
</script>

<Story name="Directory" />
