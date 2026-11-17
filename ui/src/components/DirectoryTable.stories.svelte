<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import { directory, ME, NOW } from "../stories/fixtures";
  import DirectoryTable from "./DirectoryTable.svelte";

  const { Story } = defineMeta({
    title: "Sections/DirectoryTable", component: DirectoryTable,
    args: { links: directory, total: 214, me: ME, now: NOW, fresh: "q4", href: (l: { slug: string }) => `#/${l.slug}`, onopen: fn(), oncopy: fn(), onedit: fn() },
  });
</script>

<Story name="With usage" args={{ selected: 1 }} play={async ({ args, canvas, userEvent }) => {
  const rows = canvas.getAllByRole("row").slice(1);
  await expect(rows[1]).toHaveAttribute("aria-current", "true");
  await userEvent.keyboard("j");
  await expect(rows[2]).toHaveAttribute("aria-current", "true");
  await userEvent.keyboard("{Enter}");
  await expect(args.onopen).toHaveBeenCalledWith(expect.objectContaining({ slug: "roadmap" }));
  await userEvent.keyboard("k");
  await userEvent.keyboard("y");
  await expect(args.oncopy).toHaveBeenCalledWith(expect.objectContaining({ slug: "bug" }));
  await userEvent.keyboard("e");
  await expect(args.onedit).toHaveBeenCalledWith(expect.objectContaining({ slug: "bug" }));
  await expect(canvas.getByText("8 of 214")).toBeVisible();
}} />
<Story name="No results" args={{ links: [], query: "zzz" }} />
