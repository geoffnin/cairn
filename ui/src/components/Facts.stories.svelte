<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Facts from "./Facts.svelte";

  const { Story } = defineMeta({
    title: "Parts/Facts", component: Facts,
    args: {
      items: [
        { label: "Owner", value: "maya@example.com" }, { label: "Created", value: "Mar 4, 2026" },
        { label: "Last changed", value: "Nov 15" }, { label: "Last used", value: "4 minutes ago" },
      ],
    },
  });
</script>

<Story name="Link facts" />
