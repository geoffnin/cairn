import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WhereLinksLive from "./WhereLinksLive.svelte";
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
      screen.getByRole("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      expect(open).toHaveBeenCalledWith("http://localhost:1234/_/auth/complete/", "_blank", "noopener,noreferrer");
      expect(saveServer).toHaveBeenCalledTimes(1);
      pending.resolve();
      expect(screen.queryByText(/This page updates when you come back/)).toBeNull();
      await waitFor(() => expect(screen.getByText("Sign in to localhost:1234 in the tab that just opened.")).toBeTruthy());
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
    expect(screen.getByText("Server address saved.")).toBeTruthy();
  });

  it("delegates authentication feedback while keeping save errors local", async () => {
    const onauthmessage = vi.fn();
    render(ServerSetup, {
      saveServer: async () => { throw new Error("Could not save the address"); },
      authenticate: async () => {},
      onauthmessage,
    });
    await fireEvent.input(screen.getByLabelText("Server URL"), { target: { value: "go.example.com" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(onauthmessage).toHaveBeenCalledWith(
      "Sign in to go.example.com in the tab that just opened.", false,
    ));
    await waitFor(() => expect(screen.getByText("Could not save the address")).toBeTruthy());
    expect(screen.queryByText(/Sign in to/)).toBeNull();
    expect(onauthmessage).toHaveBeenCalledTimes(1);
  });

  it("delegates authentication failures without replacing save errors", async () => {
    const onauthmessage = vi.fn();
    render(ServerSetup, {
      saveServer: async () => { throw new Error("Could not save the address"); },
      authenticate: async () => { throw new Error("Permission denied"); },
      onauthmessage,
    });
    await fireEvent.input(screen.getByLabelText("Server URL"), { target: { value: "go.example.com" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => expect(onauthmessage).toHaveBeenCalledWith("Permission denied", true));
    await waitFor(() => expect(screen.getByText("Could not save the address")).toBeTruthy());
    expect(screen.queryByText("Permission denied")).toBeNull();
  });


  it("writes the original URL again after an obsolete save succeeds and the newer one fails", async () => {
    const first = deferred();
    const saveServer = vi.fn().mockReturnValueOnce(first.promise).mockRejectedValueOnce(new Error("Save failed")).mockResolvedValue(undefined);
    render(ServerSetup, { serverUrl: "https://original.example.com", saveServer });
    const input = screen.getByLabelText("Server URL");
    await fireEvent.input(input, { target: { value: "a.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenCalledTimes(1));
    await fireEvent.input(input, { target: { value: "b.example.com" } });
    await fireEvent.blur(input);
    first.resolve();
    await screen.findByText("Save failed");
    await fireEvent.input(input, { target: { value: "original.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenNthCalledWith(3, "https://original.example.com"));
    await screen.findByText("Server address saved.");
  });

  it("preserves a newer invalid draft through save completion and incoming props", async () => {
    const pending = deferred();
    const { rerender } = render(ServerSetup, { saveServer: () => pending.promise });
    const input = screen.getByLabelText("Server URL") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "a.example.com" } });
    await fireEvent.blur(input);
    await fireEvent.input(input, { target: { value: "http://bad.example.com" } });
    await fireEvent.blur(input);
    pending.resolve();
    await rerender({ serverUrl: "https://a.example.com" });
    expect(input.value).toBe("http://bad.example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("Server address saved.")).toBeNull();
  });

  it("uses external URL changes for deduplication when the draft is clean", async () => {
    const saveServer = vi.fn(async () => {});
    const { rerender } = render(ServerSetup, { serverUrl: "https://a.example.com", saveServer });
    await rerender({ serverUrl: "https://b.example.com" });
    const input = screen.getByLabelText("Server URL") as HTMLInputElement;
    expect(input.value).toBe("https://b.example.com");
    await fireEvent.input(input, { target: { value: "a.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenCalledWith("https://a.example.com"));
  });

  it("keeps one queue across mode changes and honors the final Local choice", async () => {
    const first = deferred();
    const saveServer = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    render(WhereLinksLive, { saveServer, mode: "shared" });
    const input = screen.getByLabelText("Server URL") as HTMLInputElement;
    const local = screen.getByRole("radio", { name: "This browser" }) as HTMLInputElement;
    const shared = screen.getByRole("radio", { name: "Your company’s server" });
    await fireEvent.input(input, { target: { value: "a.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenCalledTimes(1));
    await fireEvent.click(local);
    await fireEvent.click(shared);
    expect(screen.getByLabelText("Server URL")).toBe(input);
    await fireEvent.input(input, { target: { value: "b.example.com" } });
    await fireEvent.blur(input);
    expect(saveServer).toHaveBeenCalledTimes(1);
    await fireEvent.click(local);
    first.resolve();
    await waitFor(() => expect(saveServer).toHaveBeenNthCalledWith(2, "https://b.example.com"));
    await waitFor(() => expect(input.value).toBe("https://b.example.com"));
    expect(local.checked).toBe(true);
  });

  it.each([false, true])("marks the latest blur of an in-flight URL clean unless edited again (%s)", async (editAgain) => {
    const pending = deferred();
    const saveServer = vi.fn(() => pending.promise);
    const { rerender } = render(ServerSetup, { saveServer });
    const input = screen.getByLabelText("Server URL") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "a.example.com" } });
    await fireEvent.blur(input);
    await waitFor(() => expect(saveServer).toHaveBeenCalledTimes(1));
    await fireEvent.input(input, { target: { value: "a.example.com/path" } });
    await fireEvent.blur(input);
    if (editAgain) await fireEvent.input(input, { target: { value: "http://invalid.example.com" } });
    pending.resolve();
    if (!editAgain) await screen.findByText("Server address saved.");
    await rerender({ serverUrl: "https://external.example.com" });
    expect(input.value).toBe(editAgain ? "http://invalid.example.com" : "https://external.example.com");
    expect(saveServer).toHaveBeenCalledTimes(1);
  });

});
