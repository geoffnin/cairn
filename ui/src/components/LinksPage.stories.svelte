<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, waitFor } from "storybook/test";
  import { directory } from "../stories/fixtures";
  import { memorySource } from "../stories/memorySource";
  import LinksPage from "./LinksPage.svelte";

  const { Story } = defineMeta({
    title: "Journeys/0 Manage links (today)",
    component: LinksPage,
    parameters: { layout: "fullscreen" },
  });
</script>

<!-- A new source on every mount, so a replayed story starts from its own links again. -->
{#snippet fresh(_: unknown, { parameters }: { parameters: { links?: typeof directory } })}
  <LinksPage source={memorySource(parameters.links ?? [])} />
{/snippet}

<Story name="This browser" template={fresh} parameters={{ links: directory }} play={async ({ canvas, userEvent }) => {
  const form = canvas.getByRole("button", { name: "Create link" }).closest("form")!;
  await userEvent.type(form.querySelector("input")!, "wiki");
  await userEvent.type(canvas.getAllByLabelText("Destination URL")[0]!, "https://wiki.example.com/{Enter}");
  await waitFor(() => expect(canvas.getByRole("link", { name: "wiki" })).toBeVisible());
}} />
<Story name="Empty" template={fresh} />
