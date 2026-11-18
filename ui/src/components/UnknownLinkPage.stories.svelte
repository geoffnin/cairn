<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";
  import { HOST, similar } from "../stories/fixtures";
  import UnknownLinkPage from "./UnknownLinkPage.svelte";

  const { Story } = defineMeta({
    title: "Journeys/3b Server: a name nobody has made",
    component: UnknownLinkPage,
    parameters: { layout: "fullscreen" },
    args: { host: HOST, slug: "oncall-sre", similar, tries: 3, href: (l: { slug: string }) => `#/${l.slug}`, create: fn(async (l) => l), oncreated: fn() },
  });
</script>

<Story name="With suggestions" play={async ({ canvas }) => {
  await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("oncall-sre isn’t a link yet");
  await expect(canvas.getByRole("list", { name: "Similar links" })).toBeVisible();
  await expect(canvas.getByLabelText("Destination")).toHaveFocus();
}} />
<Story name="Nothing similar" args={{ slug: "zebra", similar: [], tries: 0 }} />
