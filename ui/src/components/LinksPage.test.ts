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

const ME = "me@example.com";

/** Links in memory, filtered like the real sources. `gate` holds writes until it resolves. */
function memorySource(initial: Link[] = [], shared = false) {
  const links = new Map(initial.map((l) => [l.slug, l]));
  const source = {
    links,
    shared,
    gate: Promise.resolve(),
    creates: 0,
    async list({ q, mine }: { q: string; mine: boolean }) {
      return [...links.values()]
        .filter((l) => !q || [l.slug, l.url, l.description].some((v) => v.includes(q)))
        .filter((l) => !mine || l.owner === ME)
        .sort((a, b) => a.slug.localeCompare(b.slug));
    },
    async get(slug: string) {
      return links.get(slug) ?? null;
    },
    async create(l: Link) {
      source.creates++;
      await source.gate;
      if (links.has(l.slug)) throw new Error(`go/${l.slug} already exists.`);
      const link = { ...l };
      links.set(l.slug, link);
      return link;
    },
    async update(l: Link, changes: Partial<Link>) {
      await source.gate;
      links.set(l.slug, { ...l, ...changes });
    },
    async remove(l: Link) {
      links.delete(l.slug);
    },
    href: (l: Link) => `/${l.slug}`,
    confirmDelete: (l: Link) => `Delete go/${l.slug}?`,
  } satisfies LinkSource & Record<string, unknown>;
  return source;
}
function held() {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
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
    await waitFor(() => expect(form().getByRole("alert").textContent).toBe("wiki already exists."));
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("wiki");
  });

  it("prefills an unknown name from ?new= and focuses the destination", async () => {
    history.replaceState(null, "", "/_/?new=roadmap");
    render(LinksPage, { source: memorySource() });
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("roadmap");
    await waitFor(() => expect(document.activeElement).toBe(form().getByLabelText("Destination URL")));
    await waitFor(() => expect(form().getByText("go/roadmap is free")).toBeTruthy());
  });

  it("says a taken name already exists, beside and under the field, and does not send it", async () => {
    const source = memorySource([wiki]);
    render(LinksPage, { source });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "Wiki" } });
    await fireEvent.input(form().getByLabelText("Destination URL"), { target: { value: "https://x.test" } });
    await waitFor(() => expect(form().getByText("go/wiki already exists.")).toBeTruthy());
    expect(form().getByLabelText("Name").getAttribute("aria-invalid")).toBe("true");
    await fireEvent.submit(screen.getByRole("button", { name: "Create link" }).closest("form")!);
    expect(source.creates).toBe(0);
    expect(document.activeElement).toBe(form().getByLabelText("Name"));
  });

  it("never calls a name free that could not be a link", async () => {
    const source = memorySource();
    const get = vi.spyOn(source, "get");
    render(LinksPage, { source });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "road map" } });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: ".." } });
    await new Promise((r) => setTimeout(r, 300));
    expect(get).not.toHaveBeenCalled();
    expect(form().queryByText(/is free/)).toBeNull();
  });

  it("calls a name free again once its link is deleted", async () => {
    render(LinksPage, { source: memorySource([wiki]) });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "wiki" } });
    await waitFor(() => expect(form().getByText("go/wiki already exists.")).toBeTruthy());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(form().getByText("go/wiki is free")).toBeTruthy());
    expect(form().queryByText("go/wiki already exists.")).toBeNull();
  });

  it("hands over a description from ?desc= with the rest of the draft", async () => {
    history.replaceState(null, "", "/_/?new=roadmap&url=https%3A%2F%2Fdocs.example.com&desc=The%20plan");
    render(LinksPage, { source: memorySource() });
    expect((form().getByLabelText("Destination URL") as HTMLInputElement).value).toBe("https://docs.example.com");
    expect((form().getByLabelText("Description (optional)") as HTMLInputElement).value).toBe("The plan");
  });

  it("shows no empty state until the list has answered, and none at all if it fails", async () => {
    const source = memorySource();
    let fail = true;
    source.list = async () => {
      if (fail) throw new Error("Your sign-in has expired. Reload the page to sign in again.");
      return [];
    };
    render(LinksPage, { source });
    expect(await screen.findByText("Your sign-in has expired. Reload the page to sign in again.")).toBeTruthy();
    expect(screen.queryByText("No links yet. Make the first one.")).toBeNull();

    // The next load works: the error goes, the empty state appears.
    fail = false;
    await fireEvent.input(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(await screen.findByText("No links yet. Make the first one.")).toBeTruthy();
    expect(screen.queryByText(/sign-in has expired/)).toBeNull();
  });

  it("creates once however often Create is pressed, and keeps what was typed meanwhile", async () => {
    const source = memorySource();
    const { gate, release } = held();
    source.gate = gate;
    render(LinksPage, { source });
    await fireEvent.input(form().getByLabelText("Name"), { target: { value: "wiki" } });
    await fireEvent.input(form().getByLabelText("Destination URL"), { target: { value: "https://wiki.example.com/" } });
    const submit = () => fireEvent.submit(screen.getByRole("button", { name: "Create link" }).closest("form")!);
    await submit();
    await submit();
    await fireEvent.input(form().getByLabelText("Description (optional)"), { target: { value: "typed meanwhile" } });
    release();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(source.creates).toBe(1);
    expect((form().getByLabelText("Name") as HTMLInputElement).value).toBe("");
    expect((form().getByLabelText("Description (optional)") as HTMLInputElement).value).toBe("typed meanwhile");
  });

  it("filters as people type, descriptions included, and says what found nothing", async () => {
    render(LinksPage, { source: memorySource([wiki, { slug: "bug", url: "https://tracker.example.com/{*}", description: "" }]) });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await fireEvent.input(screen.getByRole("searchbox"), { target: { value: "handbook" } });
    await waitFor(() => expect(rows()).toHaveLength(1));
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

  it("reports a save that finishes after the dialog was cancelled, without breaking", async () => {
    const source = memorySource([wiki]);
    const { gate, release } = held();
    source.gate = gate;
    render(LinksPage, { source });
    await fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");
    await fireEvent.input(within(dialog).getByLabelText("Destination URL"), { target: { value: "https://new.example.com/" } });
    await fireEvent.submit(within(dialog).getByRole("button", { name: "Save" }).closest("form")!);
    await fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    release();
    await waitFor(() => expect(screen.getByText(/^Saved/).textContent).toBe("Saved wiki."));
    expect(source.links.get("wiki")?.url).toBe("https://new.example.com/");
  });

  it("'Only mine' filters to the reader's links", async () => {
    const mine: Link = { ...wiki, owner: ME, can_edit: true };
    const theirs: Link = { slug: "bug", url: "https://tracker.example.com/{*}", description: "", owner: "someone@example.com" };
    render(LinksPage, { source: memorySource([mine, theirs], true) });
    await waitFor(() => expect(rows()).toHaveLength(2));
    await fireEvent.click(screen.getByLabelText("Only mine"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]!).getByText(ME)).toBeTruthy();
    await fireEvent.click(screen.getByLabelText("Only mine"));
    await waitFor(() => expect(rows()).toHaveLength(2));
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
