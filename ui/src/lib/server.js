/** Normalize an entered server address to its origin. Bare loopback addresses use HTTP. */
export function normalizeServerUrl(raw) {
  let address = String(raw).trim();
  if (!address) throw new Error("Enter a server address, like go.example.com or localhost:8787");
  // A port is not a URL scheme (new URL('localhost:8787') treats it as one).
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(address)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(address) && !/^[^/:]+:\d+(?:[/?#]|$)/.test(address)) {
      throw new Error("Enter a server address using https://, or http:// for localhost");
    }
    const host = address.replace(/^\/\//, "").split(/[/?#]/)[0];
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) || /^\[::1\](:\d+)?$/.test(host);
    address = `${local ? "http" : "https"}://${address.replace(/^\/\//, "")}`;
  }
  let url;
  try { url = new URL(address); }
  catch { throw new Error("Enter a server address, like go.example.com or localhost:8787"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("The server URL must use https://, except on localhost");
  }
  if (url.username || url.password) throw new Error("Enter the server address without a username or password");
  return url.origin;
}

export const serverAuthenticationUrl = (url) => `${normalizeServerUrl(url)}/_/auth/complete/`;
