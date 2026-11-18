/** Returns a clean origin ("https://go.example.com") or throws with a user-facing message. */
export function normalizeServerUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw new Error("Enter a full URL, like https://go.example.com");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("The server URL must use https://");
  }
  return url.origin;
}

