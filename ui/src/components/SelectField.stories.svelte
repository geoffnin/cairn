<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import SelectField from "./SelectField.svelte";

  const options = [{ value: "used", label: "Most used" }, { value: "updated", label: "Recently updated" }, { value: "name", label: "Name" }];
  const { Story } = defineMeta({ title: "Primitives/SelectField", component: SelectField, args: { label: "Sort", value: "used", options } });
</script>

<Story name="Stacked" />
<Story name="Inline" args={{ inline: true }} />
