<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { ComponentProps } from "svelte";
  import { expect, fn, waitFor } from "storybook/test";
  import { directory } from "../stories/fixtures";
  import Frame from "../stories/Frame.svelte";
  import PopupDemo from "../stories/PopupDemo.svelte";
  import ToolbarPopup from "./ToolbarPopup.svelte";

  const bug = directory.find((l) => l.slug === "bug")!;
  const q4 = { slug: "q4", url: "https://docs.example.com/planning/2026/q4-planning", description: "Q4 planning" };

  const { Story } = defineMeta({
    title: "Journeys/2 Toolbar popup",
    component: ToolbarPopup,
    parameters: { layout: "padded" },
    args: {
      where: { local: true },
      copy: fn(async () => {}),
      oncreate: fn(), onslugchange: fn(), onedit: fn(), onundo: fn(), onsignin: fn(), onchangeserver: fn(),
    },
  });
</script>

{#snippet framed(args: ComponentProps<typeof ToolbarPopup>)}
  <Frame><ToolbarPopup {...args} /></Frame>
{/snippet}

<Story name="A: A page with no link yet" template={framed}
  args={{ view: { kind: "new", check: { state: "free" } }, slug: "q4", tab: { url: q4.url, title: "Q4 planning" } }}
  play={async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByLabelText("Name")).toHaveFocus();
    await expect(canvas.getByText("go/q4 is free")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    await expect(args.oncreate).toHaveBeenCalledWith({ slug: "q4", url: q4.url, description: "Q4 planning" });
  }}
/>

<Story name="B: This page already has a link" template={framed}
  args={{
    view: { kind: "linked", existing: [{ slug: "rfc-42", url: "https://docs.example.com/rfcs/0042", description: "RFC 0042" }] },
    slug: "rfc", tab: { url: "https://docs.example.com/rfcs/0042", title: "RFC 0042: Shared link ownership" },
  }}
  play={async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Make 0042 a {*}" }));
    const dest = canvas.getByLabelText(/Destination/);
    await expect(dest).toHaveValue("https://docs.example.com/rfcs/{*}");
    await expect(dest).toHaveAccessibleDescription("rfc/0042 opens this page; rfc/7 opens …/rfcs/7.");
  }}
/>

<Story name="C: The name is taken" template={framed}
  args={{
    view: { kind: "new", check: { state: "taken", link: bug, alternative: "bug-tracker" } },
    slug: "bug", tab: { url: "https://other.example.com/", title: "Other example" },
  }}
  play={async ({ args, canvas, userEvent }) => {
    const name = canvas.getByLabelText("Name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription(/bug already exists/);
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    await expect(args.oncreate).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Use go/bug-tracker" }));
    await expect(name).toHaveValue("bug-tracker");
    await expect(args.onslugchange).toHaveBeenCalledWith("bug-tracker");
  }}
/>

<Story name="D: Just created" template={framed}
  args={{ view: { kind: "created", link: q4 } }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Copy link" }));
    await expect(args.copy).toHaveBeenCalledWith("http://go/q4");
    await userEvent.click(canvas.getByRole("button", { name: "Undo" }));
    await expect(args.onundo).toHaveBeenCalledWith(q4);
  }}
/>

<Story name="E: Shared server, signed out" template={framed}
  args={{ view: { kind: "signed-out", server: "go.acme.com" }, where: { server: "go.acme.com" } }}
  play={async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await expect(args.onsignin).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("link", { name: "Use a different server" }));
    await expect(args.onchangeserver).toHaveBeenCalled();
  }}
/>

<Story name="All five states" parameters={{ layout: "fullscreen" }}>
  {#snippet template(args)}
    <div style="display: flex; flex-wrap: wrap; gap: 32px; padding: 48px; align-items: start">
      <Frame caption="A · A page with no link yet">
        <ToolbarPopup {...args} view={{ kind: "new", check: { state: "free" } }} slug="q4" tab={{ url: q4.url, title: "Q4 planning" }} />
      </Frame>
      <Frame caption="B · This page already has a link">
        <ToolbarPopup {...args} view={{ kind: "linked", existing: [{ slug: "rfc-42", url: "", description: "" }] }} slug="rfc" tab={{ url: "https://docs.example.com/rfcs/0042", title: "RFC 0042: Shared link ownership" }} />
      </Frame>
      <Frame caption="C · The name is taken">
        <ToolbarPopup {...args} view={{ kind: "new", check: { state: "taken", link: bug, alternative: "bug-tracker" } }} slug="bug" tab={{ url: "https://other.example.com/", title: "Other example" }} />
      </Frame>
      <Frame caption="D · Just created"><ToolbarPopup {...args} view={{ kind: "created", link: q4 }} /></Frame>
      <Frame caption="E · Shared server, signed out">
        <ToolbarPopup {...args} view={{ kind: "signed-out", server: "go.acme.com" }} where={{ server: "go.acme.com" }} />
      </Frame>
    </div>
  {/snippet}
</Story>

<Story name="Interactive: make a link"
  play={async ({ canvas, userEvent }) => {
    const name = canvas.getByLabelText("Name");
    await userEvent.type(name, "bug");
    await expect(await canvas.findByText("go/bug already exists")).toHaveAttribute("role", "status");
    await userEvent.click(canvas.getByRole("button", { name: "Use go/bug-docs" }));
    await expect(name).toHaveValue("bug-docs");
    await expect(canvas.getByText("go/bug-docs is free")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Create link" }));
    const dest = await canvas.findByText("→ docs.example.com/…/q4-planning");
    await waitFor(() => expect(dest).toBeVisible()); // it settles in
    await userEvent.click(canvas.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(canvas.getByLabelText("Name")).toHaveValue("bug-docs"));
  }}
>
  {#snippet template()}
    <Frame caption="Type a name (try bug), then create, then undo.">
      <PopupDemo links={directory} tab={{ url: q4.url, title: "Q4 planning" }} />
    </Frame>
  {/snippet}
</Story>
