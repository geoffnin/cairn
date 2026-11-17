import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Link, LinkSource } from "../lib/links";
import LinksPage from "./LinksPage.svelte";

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

function memorySource(initial: Link[] = [], shared = false): LinkSource & { links: Map<string, Link> } {
  const links = new Map(initial.map((l) => [l.slug, l]));
  return {
    links,
    shared,
    async list({ q }) {
      return [...links.values()].filter((l) => !q || l.slug.includes(q) || l.url.includes(q)).sort((a, b) => a.slug.localeCompare(b.slug));
    },
    async create(l) {
      if (links.has(l.slug)) throw new Error(`go/${l.slug} already exists.`);
      const link = { ...l };
      links.set(l.slug, link);
      return link;
    },
    async update(l, changes) {
      links.set(l.slug, { ...l, ...changes });
    },
    async remove(l) {
      links.delete(l.slug);
    },
    href: (l) => `/${l.slug}`,
    confirmDelete: (l) => `Delete go/${l.slug}?`,
  };
}

const wiki: Link = { slug: "wiki", url: "https://wiki.example.com/", description: "Team handbook" };
const rows = () => screen.getAllByRole("row").slice(1); // minus the header
// The New link card; the edit dialog has fields with the same labels.
const form = () => within(screen.getByRole("button", { name: "Create link" }).closest("form")!);

beforeEach(() => history.replaceState(null, "", "/_/"));
afterEach(() => vi.restoreAllMocks());

describe("LinksPage", () => {
  it("shows the empty state, then a created link settling in with a status line", async () => {
    render(LinksPage, { source: memorySource() });
    expect(await screen.findByText("No links yet. Make the first one.")).toBeTruthy();

    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "wiki" } });
    await fireEvent.input(form().getByLabelText("Destination URL"), { target: { value: "https://wiki.example.com/" } });
    await fireEvent.submit(screen.getByRole("button", { name: "Create link" }).closest("form")!);

    await waitFor(() => expect(rows()).toHaveLength(1));
    const row = rows()[0]!;
    expect(row.classList.contains("fresh")).toBe(true);
    expect(within(row).getByRole("link", { name: "wiki" }).getAttribute("href")).toBe("/wiki");
    expect(within(row).getByText("wiki.example.com")).toBeTruthy();
    const status = screen.getAllByRole("status").find((s) => s.textContent?.includes("Created"))!;
    expect(status.textContent).toBe("Created wiki."); // "go/" comes from CSS
    expect(status.querySelector(".go")?.textContent).toBe("wiki");
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("");
  });

  it("says what went wrong, as an alert, and keeps what was typed", async () => {
    render(LinksPage, { source: memorySource([wiki]) });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "wiki" } });
    await fireEvent.input(form().getByLabelText("Destination URL"), { target: { value: "https://x.test" } });
    await fireEvent.submit(screen.getByRole("button", { name: "Create link" }).closest("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("wiki already exists.");
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("wiki");
  });

  it("prefills an unknown name from ?new= and focuses the destination", async () => {
    history.replaceState(null, "", "/_/?new=roadmap");
    render(LinksPage, { source: memorySource() });
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("roadmap");
    expect(screen.getByText(/does not exist yet/).textContent).toBe("roadmap does not exist yet. Add a destination to create it.");
    await waitFor(() => expect(document.activeElement).toBe(form().getByLabelText("Destination URL")));
  });

  it("filters as people type and says what found nothing", async () => {
    render(LinksPage, { source: memorySource([wiki, { slug: "bug", url: "https://tracker.example.com/{*}", description: "" }]) });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await fireEvent.input(screen.getByRole("searchbox"), { target: { value: "nothing" } });
    expect(await screen.findByText("No links match “nothing”.")).toBeTruthy();
  });

  it("edits in the dialog and deletes after confirming", async () => {
    const source = memorySource([wiki]);
    render(LinksPage, { source });
    await fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    await fireEvent.input(within(dialog).getByLabelText("Destination URL"), { target: { value: "https://new.example.com/" } });
    await fireEvent.submit(within(dialog).getByRole("button", { name: "Save" }).closest("form")!);
    await waitFor(() => expect(source.links.get("wiki")?.url).toBe("https://new.example.com/"));
    expect(await screen.findByText(/^Saved/)).toBeTruthy();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(source.links.size).toBe(0));
    expect(window.confirm).toHaveBeenCalledWith("Delete go/wiki?");
  });

  it("shows owners, edit rights and 'Only mine' only for a shared server", async () => {
    const theirs: Link = { ...wiki, owner: "someone@example.com", can_edit: false };
    const { unmount } = render(LinksPage, { source: memorySource([theirs], true) });
    expect(await screen.findByText("someone@example.com")).toBeTruthy();
    expect(screen.getByLabelText("Only mine")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    unmount();

    render(LinksPage, { source: memorySource([wiki]) });
    await screen.findByRole("button", { name: "Edit" });
    expect(screen.queryByText("Owner")).toBeNull();
    expect(screen.queryByLabelText("Only mine")).toBeNull();
  });
});
