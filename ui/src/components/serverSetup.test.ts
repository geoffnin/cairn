import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import ServerSetup from "./ServerSetup.svelte";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("server address persistence and authentication", () => {
  it("serializes edits and publishes only the latest saved address", async () => {
    const first = deferred();
    const second = deferred();
    const saveServer = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onsaved = vi.fn();
    render(ServerSetup, { saveServer, onsaved });
    const input = screen.getByLabelText("Server URL") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "first.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenCalledTimes(1));
    await fireEvent.input(input, { target: { value: "localhost:1234/forward" } });
    await fireEvent.blur(input);
    expect(saveServer).toHaveBeenCalledTimes(1);
    first.resolve();
    await waitFor(() => expect(saveServer).toHaveBeenCalledTimes(2));
    expect(onsaved).not.toHaveBeenCalled();
    second.resolve();
    await waitFor(() => expect(onsaved).toHaveBeenCalledWith("http://localhost:1234"));
    expect(input.value).toBe("http://localhost:1234");
  });

  it("opens the auth page during the submit gesture without waiting for or duplicating a blur save", async () => {
    const pending = deferred();
    const saveServer = vi.fn(() => pending.promise);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    try {
      render(ServerSetup, { saveServer });
      const input = screen.getByLabelText("Server URL");
      await fireEvent.input(input, { target: { value: "localhost:1234/forward" } });
      await fireEvent.blur(input);
      await fireEvent.submit(screen.getByRole("form"));
      expect(open).toHaveBeenCalledWith("http://localhost:1234/_/auth/complete/", "_blank", "noopener,noreferrer");
      expect(saveServer).toHaveBeenCalledTimes(1);
      pending.resolve();
      await waitFor(() => expect(screen.getByText("Finish signing in in the new tab, then return here.")).toBeTruthy());
    } finally { open.mockRestore(); }
  });

  it("keeps an authentication error visible when a slower save completes", async () => {
    const pending = deferred();
    render(ServerSetup, {
      saveServer: () => pending.promise,
      authenticate: async () => { throw new Error("Permission denied"); },
    });
    await fireEvent.input(screen.getByLabelText("Server URL"), { target: { value: "go.example.com" } });
    await fireEvent.submit(screen.getByRole("form"));
    pending.resolve();
    await waitFor(() => expect(screen.getByText("Permission denied")).toBeTruthy());
    expect(screen.queryByText("Server address saved.")).toBeNull();
  });
});
