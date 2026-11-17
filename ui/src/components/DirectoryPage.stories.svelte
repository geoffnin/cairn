<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, waitFor } from "storybook/test";
  import DirectoryDemo from "../stories/DirectoryDemo.svelte";

  const { Story } = defineMeta({
    title: "Journeys/3a Server: all links",
    component: DirectoryDemo,
    parameters: { layout: "fullscreen" },
    args: { selected: 1, onnew: fn(), onopen: fn(), oncopy: fn(), onedit: fn() },
  });
</script>

<Story name="Finding a shared link" />

<Story name="Search, filter and sort" play={async ({ canvas, userEvent }) => {
  const rows = () => canvas.getAllByRole("row").slice(1);
  await userEvent.keyboard("/");
  await userEvent.keyboard("wiki");
  await waitFor(() => expect(rows()).toHaveLength(1));
  await expect(rows()[0]).toHaveTextContent("handbook");
  await expect(canvas.getByText("1 of 214")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await userEvent.click(canvas.getByRole("button", { name: /Mine/ }));
  await waitFor(() => expect(canvas.getByText("2 of 12")).toBeVisible());
  await userEvent.click(canvas.getByRole("button", { name: /All/ }));
  await userEvent.selectOptions(canvas.getByLabelText("Sort"), "Name");
  await waitFor(() => expect(rows()[1]).toHaveTextContent("bug"));
}} />
