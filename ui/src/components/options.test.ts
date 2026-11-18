import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Options from "../../../extension/src/Options.svelte";
import { getState, hasServerAccess, probe } from "../../../extension/config.js";

vi.mock("../../../extension/config.js", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../extension/config.js")>(),
  getState: vi.fn(),
  hasServerAccess: vi.fn(),
  probe: vi.fn(),
}));
vi.mock("../../../extension/local.js", () => ({ countLinks: async () => 0 }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("chrome", {
    permissions: { request: vi.fn(async () => true) },
    tabs: { create: vi.fn(async () => ({})) },
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  const server = { kind: "server" as const, url: "https://go.example.com", label: "go.example.com" };
  vi.mocked(getState).mockResolvedValue({ mode: "shared", server, active: server, choices: [server], managed: false });
  vi.mocked(hasServerAccess).mockResolvedValue(true);
  vi.mocked(probe).mockResolvedValue({ signedOut: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("replaces the only pending sign-in message when the Settings focus probe succeeds", async () => {
  render(Options);
  await screen.findByText("Not signed in (or the server is not reachable).");
  await fireEvent.submit(screen.getByRole("form"));
  const pending = "Sign in to go.example.com in the tab that just opened. This page updates when you come back.";
  await screen.findByText(pending);
  expect(screen.getAllByText(pending)).toHaveLength(1);
  expect(screen.queryByText(/Finish signing in/)).toBeNull();

  vi.mocked(probe).mockResolvedValue({ email: "test@example.com" });
  await fireEvent(window, new Event("focus"));
  await screen.findByText("Signed in to go.example.com as test@example.com.");
  await waitFor(() => expect(screen.queryByText(pending)).toBeNull());
  expect(screen.queryByText(/Finish signing in/)).toBeNull();
});
