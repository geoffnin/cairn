import { describe, expect, it } from "vitest";
import { normalizeServerUrl, serverAuthenticationUrl } from "./server.js";

describe("server addresses", () => {
  it.each([
    ["go.example.com", "https://go.example.com"],
    [" go.example.com:8443/forward?q=1 ", "https://go.example.com:8443"],
    ["localhost:1234/forward", "http://localhost:1234"],
    ["LOCALHOST", "http://localhost"],
    ["127.0.0.1:8787", "http://127.0.0.1:8787"],
    ["[0:0:0:0:0:0:0:1]:8787", "http://[::1]:8787"],
    ["https://[0:0:0:0:0:0:0:1]:8787", "https://[::1]:8787"],
    ["//go.example.com/path", "https://go.example.com"],
    ["127.0.0.2:8787", "https://127.0.0.2:8787"],
    ["[::1]:8787/path", "http://[::1]:8787"],
    ["http://localhost:8787/", "http://localhost:8787"],
    ["https://localhost:8787", "https://localhost:8787"],
    ["https://go.example.com/forward", "https://go.example.com"],
    ["//localhost:8787", "http://localhost:8787"],
    ["localhost.example.com", "https://localhost.example.com"],
  ])("normalizes %s", (input, expected) => expect(normalizeServerUrl(input)).toBe(expected));
  it.each(["/forward", "/", "///forward", "http://127.0.0.2:8787", "", "not an address", "http://go.example.com", "http://localhost.evil.example", "javascript:alert(1)", "ftp://go.example.com", "https://user:pass@go.example.com", "https://"]) ("rejects %s", (input) => expect(() => normalizeServerUrl(input)).toThrow());
  it("uses the dedicated authentication page, ignoring pasted paths", () => {
    expect(serverAuthenticationUrl("localhost:1234/forward")).toBe("http://localhost:1234/_/auth/complete/");
    expect(serverAuthenticationUrl("go.example.com")).toBe("https://go.example.com/_/auth/complete/");
  });
});
