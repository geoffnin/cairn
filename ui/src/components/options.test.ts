import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Options from "../../../extension/src/Options.svelte";
import { getState, hasServerAccess, probe } from "../../../extension/config.js";

vi.mock("../../../extension/config.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../extension/config.js")>(),
  hasServerAccess: vi.fn(),
  probe: vi.fn(),
}));
vi.mock("../../../extension/local.js", () => ({ countLinks: async () => 0 }));

let stored: Record<string, unknown>;
let listeners: Set<() => void>;
const persist = async (values: Record<string, unknown>) => {
  Object.assign(stored, values);
  for (const listener of listeners) listener();
};
const write = vi.fn(persist);
const requestAccess = vi.fn(async () => true);

beforeEach(() => {
  vi.resetAllMocks();
  stored = { mode: "shared", serverUrl: "https://go.example.com" };
  listeners = new Set();
  write.mockImplementation(persist);
  requestAccess.mockResolvedValue(true);
  vi.stubGlobal("chrome", {
    permissions: { request: requestAccess },
    tabs: { create: vi.fn(async () => ({})) },
    storage: {
      managed: { get: async () => ({}) },
      sync: { get: async () => ({ ...stored }), set: write },
      onChanged: { addListener: (fn: () => void) => listeners.add(fn), removeListener: (fn: () => void) => listeners.delete(fn) },
    },
  });
  vi.mocked(hasServerAccess).mockResolvedValue(true);
  vi.mocked(probe).mockResolvedValue({ signedOut: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function show() {
  render(Options);
  const input = screen.getByLabelText("Server URL") as HTMLInputElement;
  await waitFor(() => expect(input.value).toBe(stored.pendingServerUrl ?? stored.serverUrl ?? ""));
  return input;
}
async function edit(input: HTMLInputElement, value = "new.example.com") {
  await fireEvent.input(input, { target: { value } });
  await fireEvent.blur(input);
}

it("replaces the only pending sign-in message when the Settings focus probe succeeds", async () => {
  await show();
  await screen.findByText("Not signed in (or the server is not reachable).");
  await fireEvent.submit(screen.getByRole("form"));
  const pending = "Sign in to go.example.com in the tab that just opened. This page updates when you come back.";
  await screen.findByText(pending);
  expect(screen.getAllByText(pending)).toHaveLength(1);
  expect(screen.queryByText(/Finish signing in/)).toBeNull();
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  await fireEvent(window, new Event("focus"));
  await screen.findByText("Signed in to go.example.com as test@example.com.");
  expect(screen.queryByText(pending)).toBeNull();
});

it("cancels Shared by clicking the already-selected Local radio while a save is pending", async () => {
  stored = { mode: "local" };
  const input = await show();
  await fireEvent.click(screen.getByRole("radio", { name: "Shared, from your company's Cairn server" }));
  await screen.findByText(/Enter your company's Cairn server address/);
  const local = screen.getByRole("radio", { name: "This browser" }) as HTMLInputElement;
  expect(local.checked).toBe(true);
  let finish!: () => void;
  write.mockImplementationOnce(async (values) => { await new Promise<void>((resolve) => { finish = resolve; }); await persist(values); });
  await edit(input);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  await fireEvent.click(local);
  finish();
  await screen.findByText("Server address saved.");
  expect(stored.pendingServerUrl).toBe("https://new.example.com");
  expect(stored.mode).toBe("local");
  expect(stored.serverUrl).toBeUndefined();
});

it("keeps the active server through permission denial and sign-in, then promotes the pending address", async () => {
  vi.mocked(hasServerAccess).mockImplementation(async (srv) => srv.url === "https://go.example.com");
  const input = await show();
  await edit(input);
  await screen.findByText("Server address saved.");
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
  requestAccess.mockResolvedValueOnce(false);
  await fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Cairn needs permission to reach new.example.com/);
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
  expect(stored.pendingServerUrl).toBe("https://new.example.com");

  vi.mocked(hasServerAccess).mockResolvedValue(true);
  await fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Sign in to new.example.com in the tab/);
  await fireEvent(window, new Event("focus"));
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  await fireEvent(window, new Event("focus"));
  await waitFor(() => expect(stored.serverUrl).toBe("https://new.example.com"));
  expect(stored.pendingServerUrl).toBeNull();
  expect(stored.mode).toBe("shared");
});

it("restores the pending address after reopening Settings without using an unusable replacement", async () => {
  stored.pendingServerUrl = "https://new.example.com";
  vi.mocked(probe).mockResolvedValue({ error: "Not a Cairn server" });
  const input = await show();
  expect(input.value).toBe("https://new.example.com");
  await fireEvent(window, new Event("focus"));
  await screen.findByText("Not a Cairn server");
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
});

it.each([false, true])("retries a failed activation independently of the saved address (Local cancellation: %s)", async (cancel) => {
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  const input = await show();
  let failActivation = true;
  write.mockImplementation(async (values) => {
    if (values.serverUrl && failActivation) { failActivation = false; throw new Error("Activation failed"); }
    await persist(values);
  });
  await edit(input);
  await screen.findByText("Activation failed");
  expect(stored.pendingServerUrl).toBe("https://new.example.com");
  expect(stored.serverUrl).toBe("https://go.example.com");
  if (cancel) await fireEvent.click(screen.getByRole("radio", { name: "This browser" }));
  await fireEvent.blur(input);
  await screen.findByText("Server address saved.");
  expect(stored.mode).toBe(cancel ? "local" : "shared");
  expect(stored.serverUrl).toBe(cancel ? "https://go.example.com" : "https://new.example.com");
});

it("ignores a ready probe if Local was chosen while it was in flight", async () => {
  const input = await show();
  let finish!: (value: { email: string }) => void;
  const ready = new Promise<{ email: string }>((resolve) => { finish = resolve; });
  vi.mocked(probe).mockImplementation((srv) => srv.url === "https://new.example.com" ? ready : Promise.resolve({ signedOut: true }));
  await edit(input);
  await waitFor(() => expect(stored.pendingServerUrl).toBe("https://new.example.com"));
  await fireEvent.click(screen.getByRole("radio", { name: "This browser" }));
  finish({ email: "test@example.com" });
  await screen.findByText("Server address saved.");
  expect(stored.mode).toBe("local");
  expect(stored.serverUrl).toBe("https://go.example.com");
});

it("clears sign-in feedback when an edit changes the server origin", async () => {
  const input = await show();
  await fireEvent.submit(screen.getByRole("form"));
  const pending = "Sign in to go.example.com in the tab that just opened. This page updates when you come back.";
  await screen.findByText(pending);
  await edit(input, "b.example.com");
  await screen.findByText("Server address saved.");
  expect(screen.queryByText(pending)).toBeNull();
  expect(stored.pendingServerUrl).toBe("https://b.example.com");
});

it("keeps same-origin sign-in feedback so the return probe can replace it", async () => {
  const input = await show();
  await fireEvent.submit(screen.getByRole("form"));
  const pending = "Sign in to go.example.com in the tab that just opened. This page updates when you come back.";
  await screen.findByText(pending);
  await edit(input, "https://go.example.com/some/path");
  expect(screen.getByText(pending)).toBeTruthy();
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  await fireEvent(window, new Event("focus"));
  await screen.findByText("Signed in to go.example.com as test@example.com.");
  expect(screen.queryByText(pending)).toBeNull();
});
