<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import NumberBadge from "./NumberBadge.svelte";

  const { Story } = defineMeta({
    title: "Primitives/NumberBadge", component: NumberBadge, args: { value: 2, tone: "moss", label: "Step 2" },
    argTypes: { tone: { control: "inline-radio", options: ["quiet", "moss", "terracotta"] } },
  });
</script>

<Story name="Current step" />
<Story name="Step to do" args={{ value: 3, tone: "quiet", label: "Step 3" }} />
<Story name="Done" args={{ done: true, tone: "quiet", label: "Step 1, done" }} />
<Story name="Change marker" args={{ value: 2, tone: "terracotta", label: "Change 2" }} />
