// Shared state for the background worker, popup and settings page.
//
//   storage.sync    backends: [{ url, prefix }]   servers the user has added
//                   active:   url                 the one currently in use
//   storage.managed serverUrl                     set by policy; overrides and locks the choice
//
// The extension holds no credentials. Each server sits behind Cloudflare Access, and the browser's
// Access session (the CF_Authorization cookie) signs in redirects, the website and API calls.

const PREFIX_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

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

/**
 * Ask a server which prefix it uses. Sends the Access session if there is one, so this works
 * either when /_/config has an Access Bypass policy or when the person is already signed in.
 */
export async function fetchServerConfig(url) {
  let res;
  try {
    res = await fetch(`${url}/_/config`, { credentials: "include", cache: "no-store" });
  } catch {
    // Behind Access with no Bypass for /_/config, signed-out requests are redirected to the
    // Access login page on another origin, which fetch reports as a network error.
    throw new Error(
      `Could not read ${url}/_/config. Check the address. If the server is behind Cloudflare Access, ` +
        "ask whoever runs it to add the Bypass policy for /_/config from Cairn's README, or sign in to the server in a tab and try again.",
    );
  }
  const cfg = res.ok ? await res.json().catch(() => null) : null;
  if (!cfg || typeof cfg.prefix !== "string" || !PREFIX_RE.test(cfg.prefix)) {
    throw new Error(`${url} does not look like a Cairn server.`);
  }
  return { url, prefix: cfg.prefix };
}

// On a profile with no policy, storage.managed.get() can throw or never settle, so bound it.
// If policy arrives later, storage.onChanged fires and the background worker re-syncs.
async function managedServerUrl() {
  const managed = await Promise.race([
    chrome.storage.managed.get("serverUrl").catch(() => ({})),
    new Promise((resolve) => setTimeout(() => resolve({}), 1000)),
  ]);
  try {
    return managed.serverUrl ? normalizeServerUrl(managed.serverUrl) : null;
  } catch {
    return null;
  }
}

/** @returns {{ backends: object[], active: object|null, managed: boolean }} */
export async function getState() {
  const [managedUrl, sync] = await Promise.all([managedServerUrl(), chrome.storage.sync.get(["backends", "active"])]);
  let backends = Array.isArray(sync.backends) ? sync.backends : [];
  let active;
  if (managedUrl) {
    // Policy pins the server. Reuse what we learned about it earlier, else assume the default prefix.
    active = backends.find((b) => b.url === managedUrl) || { url: managedUrl, prefix: "go" };
    backends = [active];
  } else {
    active = backends.find((b) => b.url === sync.active) || backends[0] || null;
  }
  return { backends, active, managed: !!managedUrl };
}

/** Add a backend, or update what we know about one. Leaves the active choice alone unless asked. */
export async function saveBackend(backend, { makeActive = false } = {}) {
  const { backends = [], active } = await chrome.storage.sync.get(["backends", "active"]);
  const clean = { url: backend.url, prefix: backend.prefix };
  const next = [...backends.filter((b) => b.url !== clean.url), clean].sort((a, b) => a.url.localeCompare(b.url));
  await chrome.storage.sync.set({ backends: next, active: makeActive || !active ? clean.url : active });
}

export async function removeBackend(url) {
  const { backends = [], active } = await chrome.storage.sync.get(["backends", "active"]);
  const next = backends.filter((b) => b.url !== url);
  await chrome.storage.sync.set({ backends: next, active: active === url ? (next[0]?.url ?? null) : active });
}

export function setActive(url) {
  return chrome.storage.sync.set({ active: url });
}

export const originsFor = (backend) => [`${backend.url}/*`, `*://${backend.prefix}/*`];
export const hasServerAccess = (backend) => chrome.permissions.contains({ origins: [`${backend.url}/*`] });
export const hasAllAccess = (backend) => chrome.permissions.contains({ origins: originsFor(backend) });

/** API call using the browser's Cloudflare Access session for the server. */
export async function api(backend, method, path, body) {
  let res;
  try {
    res = await fetch(`${backend.url}/_/api${path}`, {
      method,
      credentials: "include",
      headers: { "content-type": "application/json", "x-cairn-request": "1" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Signed out: Access redirects to its login page on another origin, which fetch cannot follow.
    throw Object.assign(new Error("Not signed in."), { status: 401 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

/** The signed-in person's email for this server, or null if not signed in (or unreachable). */
export async function whoAmI(backend) {
  try {
    return (await api(backend, "GET", "/me")).email;
  } catch {
    return null;
  }
}
