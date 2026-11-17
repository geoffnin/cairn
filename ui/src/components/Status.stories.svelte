<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Status from "./Status.svelte";

  const { Story } = defineMeta({ title: "Primitives/Status", component: Status, args: { message: { text: "Created go/wiki." } } });
</script>

<Story name="Done" />
<Story name="Error" args={{ message: { text: "go/bug already exists.", error: true } }} />
