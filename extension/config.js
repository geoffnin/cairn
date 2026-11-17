// Shared state for the background worker, popup and settings page.
//
//   storage.sync   backends: [{ url, prefix, auth }]   servers the user has added
//                  active:   url                        the one currently in use
//   storage.local  tokens:   { [url]: { token, email, expires_at } }   never synced
//   storage.managed serverUrl                           set by policy; overrides and locks the choice

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

/** Ask a server which prefix and sign-in method it uses. Public endpoint; no credentials sent. */
export async function fetchServerConfig(url) {
  let res;
  try {
    res = await fetch(`${url}/_/config`, { credentials: "omit", cache: "no-store" });
  } catch {
    throw new Error(`Could not reach ${url}. Check the address and your connection.`);
  }
  const cfg = res.ok ? await res.json().catch(() => null) : null;
  if (!cfg || typeof cfg.prefix !== "string" || !PREFIX_RE.test(cfg.prefix)) {
    throw new Error(`${url} does not look like a Cairn server.`);
  }
  return { url, prefix: cfg.prefix, auth: String(cfg.auth || "oidc") };
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

/** @returns {{ backends: object[], active: object|null, managed: boolean, token: object|null }} */
export async function getState() {
  const [managedUrl, sync, local] = await Promise.all([
    managedServerUrl(),
    chrome.storage.sync.get(["backends", "active"]),
    chrome.storage.local.get("tokens"),
  ]);
  let backends = Array.isArray(sync.backends) ? sync.backends : [];
  let active;
  if (managedUrl) {
    // Policy pins the server. Reuse what we learned about it earlier, else assume the defaults.
    active = backends.find((b) => b.url === managedUrl) || { url: managedUrl, prefix: "go", auth: "oidc" };
    backends = [active];
  } else {
    active = backends.find((b) => b.url === sync.active) || backends[0] || null;
  }
  const saved = active && local.tokens?.[active.url];
  const token = saved && saved.expires_at * 1000 > Date.now() ? saved : null;
  return { backends, active, managed: !!managedUrl, token };
}

/** Add a backend, or update what we know about one. Leaves the active choice alone unless asked. */
export async function saveBackend(backend, { makeActive = false } = {}) {
  const { backends = [], active } = await chrome.storage.sync.get(["backends", "active"]);
  const next = [...backends.filter((b) => b.url !== backend.url), backend].sort((a, b) => a.url.localeCompare(b.url));
  await chrome.storage.sync.set({ backends: next, active: makeActive || !active ? backend.url : active });
}

export async function removeBackend(url) {
  const { backends = [], active } = await chrome.storage.sync.get(["backends", "active"]);
  const next = backends.filter((b) => b.url !== url);
  await chrome.storage.sync.set({ backends: next, active: active === url ? (next[0]?.url ?? null) : active });
  await setToken(url, null);
}

export function setActive(url) {
  return chrome.storage.sync.set({ active: url });
}

export async function setToken(url, token) {
  const { tokens = {} } = await chrome.storage.local.get("tokens");
  if (token) tokens[url] = token;
  else delete tokens[url];
  await chrome.storage.local.set({ tokens });
}

export const originsFor = (backend) => [`${backend.url}/*`, `*://${backend.prefix}/*`];
export const hasServerAccess = (backend) => chrome.permissions.contains({ origins: [`${backend.url}/*`] });
export const hasAllAccess = (backend) => chrome.permissions.contains({ origins: originsFor(backend) });

/** API call as the extension's signed-in user (falls back to the site's own cookie if there is no token). */
export async function api(backend, token, method, path, body) {
  const headers = { "content-type": "application/json", "x-cairn-request": "1" };
  if (token) headers.authorization = `Bearer ${token.token}`;
  const res = await fetch(`${backend.url}/_/api${path}`, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}
