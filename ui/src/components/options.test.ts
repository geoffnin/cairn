import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Options from "../../../extension/src/Options.svelte";
import { getState, hasServerAccess, probe, setServer, setPendingServer, setMode } from "../../../extension/config.js";

vi.mock("../../../extension/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../extension/config.js")>();
  return { ...actual, hasServerAccess: vi.fn(), probe: vi.fn(), setServer: vi.fn(actual.setServer) };
});
vi.mock("../../../extension/local.js", () => ({ countLinks: async () => 0 }));

let stored: Record<string, unknown>;
let listeners: Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>;
let focusListener: () => Promise<void>;
const persist = async (values: Record<string, unknown>) => {
  const changes = Object.fromEntries(Object.entries(values)
    .filter(([key, value]) => stored[key] !== value)
    .map(([key, value]) => [key, { oldValue: stored[key], newValue: value }]));
  Object.assign(stored, values);
  for (const listener of listeners) listener(changes, "sync");
};
const write = vi.fn(persist);
const requestAccess = vi.fn(async () => true);

beforeEach(() => {
  vi.clearAllMocks();
  let lockQueue = Promise.resolve<unknown>(undefined);
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: vi.fn((_name, callback) => {
      const result = lockQueue.then(callback);
      lockQueue = result.catch(() => {});
      return result;
    }),
  } });
  const add = window.addEventListener.bind(window);
  vi.spyOn(window, "addEventListener").mockImplementation((type, listener, options) => {
    if (type === "focus") focusListener = listener as unknown as () => Promise<void>;
    add(type, listener, options);
  });
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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
  await focusListener();
  await screen.findByText("Signed in to go.example.com as test@example.com.");
  expect(screen.queryByText(pending)).toBeNull();
});

it("cancels Shared by clicking the already-selected Local radio while a save is pending", async () => {
  stored = { mode: "local" };
  vi.mocked(probe).mockImplementation(async (srv) => srv.url === "https://new.example.com" ? { email: "test@example.com" } : { signedOut: true });
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
  await focusListener();
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
  await focusListener();
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
  expect(stored.pendingServerUrl).toBe("https://new.example.com");
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  await focusListener();
  await waitFor(() => expect(stored.serverUrl).toBe("https://new.example.com"));
  expect(stored.pendingServerUrl).toBeNull();
  expect(stored.mode).toBe("shared");
});

it("restores the pending address after reopening Settings without using an unusable replacement", async () => {
  stored.pendingServerUrl = "https://new.example.com";
  vi.mocked(probe).mockResolvedValue({ error: "Not a Cairn server" });
  const input = await show();
  expect(input.value).toBe("https://new.example.com");
  await focusListener();
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
  await focusListener();
  await screen.findByText("Server address saved.");
  expect(stored.mode).toBe(cancel ? "local" : "shared");
  expect(stored.serverUrl).toBe(cancel ? "https://go.example.com" : "https://new.example.com");
});

it("ignores a ready probe if Local was chosen while it was in flight", async () => {
  const input = await show();
  let finish!: (value: { email: string }) => void;
  const ready = new Promise<{ email: string }>((resolve) => { finish = resolve; });
  let activationStarted = false;
  vi.mocked(probe).mockImplementation((_srv, signal) => {
    if (signal) { activationStarted = true; return ready; }
    return Promise.resolve({ signedOut: true });
  });
  await edit(input);
  await waitFor(() => expect(stored.pendingServerUrl).toBe("https://new.example.com"));
  await waitFor(() => expect(activationStarted).toBe(true));
  await fireEvent.click(screen.getByRole("radio", { name: "This browser" }));
  finish({ email: "test@example.com" });
  await waitFor(() => expect(setServer).toHaveBeenCalled());
  await vi.mocked(setServer).mock.results[0].value;
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
  await focusListener();
  await screen.findByText("Signed in to go.example.com as test@example.com.");
  expect(screen.queryByText(pending)).toBeNull();
});

it.each(["http://invalid.example.com", "other.example.com", "new.example.com/path"])(
  "checks the current draft before focus activation: %s", async (draft) => {
    stored.pendingServerUrl = "https://new.example.com";
    const input = await show();
    await fireEvent.input(input, { target: { value: draft } });
    vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
    await focusListener();
    const matches = draft === "new.example.com/path";
    expect(stored.serverUrl).toBe(matches ? "https://new.example.com" : "https://go.example.com");
    expect(stored.pendingServerUrl).toBe(matches ? null : "https://new.example.com");
    if (!matches) expect(input.value).toBe(draft);
  },
);

it("clears the previous server's status while the displayed pending server is being checked", async () => {
  vi.mocked(probe).mockResolvedValue({ email: "old@example.com" });
  const input = await show();
  await screen.findByText("Signed in as old@example.com.");
  let finish!: (value: { signedOut: true }) => void;
  const pending = new Promise<{ signedOut: true }>((resolve) => { finish = resolve; });
  vi.mocked(probe).mockImplementation((srv) => srv.url === "https://new.example.com" ? pending : Promise.resolve({ email: "old@example.com" }));
  await edit(input);
  await screen.findByText("Server address saved.");
  await waitFor(() => expect(screen.queryByText("Signed in as old@example.com.")).toBeNull());
  finish({ signedOut: true });
  await screen.findByText("Not signed in (or the server is not reachable).");
});

it.each(["newer edit", "toolbar Local"])("saves and allows authentication during a probe, then respects a %s", async (change) => {
  const input = await show();
  let finish!: (value: { email: string }) => void;
  let activationStarted = false;
  const pending = new Promise<{ email: string }>((resolve) => { finish = resolve; });
  vi.mocked(probe).mockImplementation((_srv, signal) => {
    if (signal) { activationStarted = true; return pending; }
    return Promise.resolve({ signedOut: true });
  });
  await edit(input);
  await screen.findByText("Server address saved.");
  await waitFor(() => expect(activationStarted).toBe(true));
  await fireEvent.submit(screen.getByRole("form"));
  await screen.findByText(/Sign in to new.example.com/);
  await waitFor(() => expect(input.disabled).toBe(false));
  expect((screen.getByRole("button", { name: "Authenticate" }) as HTMLButtonElement).disabled).toBe(false);
  if (change === "toolbar Local") await setMode("local");
  else await fireEvent.input(input, { target: { value: "http://invalid.example.com" } });
  finish({ email: "test@example.com" });
  await waitFor(() => expect(setServer).toHaveBeenCalled());
  await vi.mocked(setServer).mock.results[0].value;
  expect(stored.serverUrl).toBe("https://go.example.com");
  expect(stored.pendingServerUrl).toBe("https://new.example.com");
  if (change === "toolbar Local") expect(stored.mode).toBe("local");
  else expect(input.value).toBe("http://invalid.example.com");
});

it("selects the configured server while an unready replacement remains pending", async () => {
  stored.mode = "local";
  stored.pendingServerUrl = "https://new.example.com";
  await show();
  await fireEvent.click(screen.getByRole("radio", { name: "Shared, from your company's Cairn server" }));
  await waitFor(() => expect(stored.mode).toBe("shared"));
  await focusListener();
  expect((await getState()).active).toMatchObject({ url: "https://go.example.com" });
  expect(stored.pendingServerUrl).toBe("https://new.example.com");
});

it("activates first-time Shared setup even though its initial mode is Local", async () => {
  stored = { mode: "local" };
  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  const input = await show();
  await edit(input);
  await waitFor(() => expect(stored.mode).toBe("shared"));
  expect(stored.serverUrl).toBe("https://new.example.com");
  expect(stored.pendingServerUrl).toBeNull();
});

it("serializes promotion and a draft write from another Settings page", async () => {
  stored.pendingServerUrl = "https://verified.example.com";
  let finish!: () => void;
  write.mockImplementationOnce(async (values) => {
    await new Promise<void>((resolve) => { finish = resolve; });
    await persist(values);
  });
  const promotion = setServer("https://verified.example.com");
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  const nextDraft = setPendingServer("https://next.example.com");
  expect(write).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([promotion, nextDraft]);
  expect(stored.serverUrl).toBe("https://verified.example.com");
  expect(stored.pendingServerUrl).toBe("https://next.example.com");
});

it("retains a newer draft already saved by another Settings page when committing a verified server", async () => {
  await setPendingServer("https://next.example.com");
  await setServer("https://verified.example.com");
  expect(stored.serverUrl).toBe("https://verified.example.com");
  expect(stored.pendingServerUrl).toBe("https://next.example.com");
});

it("bounds the server probe with a ten-second abort signal", async () => {
  const actual = await vi.importActual<typeof import("../../../extension/config.js")>("../../../extension/config.js");
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  const fetch = vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  vi.stubGlobal("fetch", fetch);
  const result = actual.probe({ kind: "server", url: "https://go.example.com", label: "go.example.com" });
  expect(timeout).toHaveBeenCalledWith(10_000);
  expect(fetch).toHaveBeenCalledWith("https://go.example.com/_/api/me", expect.objectContaining({ signal: controller.signal }));
  controller.abort();
  await expect(result).resolves.toEqual({ signedOut: true });
});
