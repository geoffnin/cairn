// Server URL resolution: enterprise policy (storage.managed) wins over the user's setting.

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

export async function getConfig() {
  // On a profile with no policy, storage.managed.get() can throw or never settle, so bound it.
  // If policy arrives later, storage.onChanged fires and the background worker re-syncs.
  const managed = await Promise.race([
    chrome.storage.managed.get("serverUrl").catch(() => ({})),
    new Promise((resolve) => setTimeout(() => resolve({}), 1000)),
  ]);
  const source = managed.serverUrl ? "managed" : "user";
  const raw = managed.serverUrl || (await chrome.storage.sync.get("serverUrl")).serverUrl;
  if (!raw) return { serverUrl: null, source };
  try {
    return { serverUrl: normalizeServerUrl(raw), source };
  } catch {
    return { serverUrl: null, source };
  }
}

export function hasServerAccess(serverUrl) {
  return chrome.permissions.contains({ origins: [`${serverUrl}/*`] });
}

/** Authenticated API call using the browser's existing session cookie for the server. */
export async function api(serverUrl, method, path, body) {
  const res = await fetch(`${serverUrl}/_/api${path}`, {
    method,
    credentials: "include",
    headers: { "content-type": "application/json", "x-cairn-request": "1" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}
