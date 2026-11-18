<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { similar } from "../stories/fixtures";
  import SimilarLinks from "./SimilarLinks.svelte";

  const { Story } = defineMeta({ title: "Sections/SimilarLinks", component: SimilarLinks, args: { links: similar, href: (l: { slug: string }) => `#/${l.slug}` } });
</script>

<Story name="Did you mean" play={async ({ canvas }) => {
  await expect(canvas.getByRole("link", { name: /oncall-runbooks/ })).toHaveAttribute("href", "#/oncall-runbooks");
  await expect(canvas.getByText("986 uses")).toBeVisible();
}} />
