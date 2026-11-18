<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { directory } from "../stories/fixtures";
  import NameCheckMark from "./NameCheckMark.svelte";

  const { Story } = defineMeta({ title: "Primitives/NameCheckMark", component: NameCheckMark, args: { slug: "q4", check: { state: "free" } } });
</script>

<Story name="Empty" args={{ slug: "", check: null }} />
<Story name="Checking" args={{ check: { state: "checking" } }} />
<Story name="Free" play={async ({ canvas }) => {
  await expect(canvas.getByRole("status")).toHaveTextContent("go/q4 is free");
}} />
<Story name="Taken" args={{ slug: "bug", check: { state: "taken", link: directory[1]! } }} play={async ({ canvas }) => {
  await expect(canvas.getByRole("status")).toHaveTextContent("go/bug already exists");
}} />
