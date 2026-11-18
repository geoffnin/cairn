<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { manySimilar, similar } from "../stories/fixtures";
  import SimilarLinks from "./SimilarLinks.svelte";

  const { Story } = defineMeta({ title: "Sections/SimilarLinks", component: SimilarLinks, args: { links: similar, href: (l: { slug: string }) => `#/${l.slug}` } });
</script>

<Story name="Did you mean" play={async ({ canvas }) => {
  await expect(canvas.getByRole("link", { name: /oncall-runbooks/ })).toHaveAttribute("href", "#/oncall-runbooks");
  await expect(canvas.queryByRole("button")).toBeNull();
}} />
<Story name="Fifty nearly the same" args={{ links: manySimilar }} play={async ({ canvas, userEvent }) => {
  await expect(canvas.getAllByRole("listitem")).toHaveLength(5);
  await userEvent.click(canvas.getByRole("button", { name: "Show all 50" }));
  await expect(canvas.getAllByRole("listitem")).toHaveLength(50);
  await expect(canvas.getByRole("button", { name: "Show fewer" })).toHaveAttribute("aria-expanded", "true");
}} />
