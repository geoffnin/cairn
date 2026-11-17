// Which backend the extension uses, and talking to Cairn servers.
//
//   storage.sync    backends: [{ url }]   Cairn servers the user has added
//                   active:   url | "local"
//   storage.managed serverUrl             set by policy; pins that server, hides local mode
//
// The backend is either this browser (local mode, see local.js) or a Cairn server behind
// Cloudflare Access. With no server chosen, local mode is used. The extension holds no
// credentials: the browser's Access session signs in redirects and API calls.

export const LOCAL = "local";
export const LOCAL_BACKEND = Object.freeze({ kind: "local", label: "This browser" });
const server = (url) => ({ kind: "server", url, label: new URL(url).host });

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

// On a profile with no policy, storage.managed.get() can throw or never settle, so bound it.
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

/** @returns {{ choices: object[], active: object, managed: boolean }} choices = local (unless managed) + servers */
export async function getState() {
  const [managedUrl, sync] = await Promise.all([managedServerUrl(), chrome.storage.sync.get(["backends", "active"])]);
  if (managedUrl) {
    const pinned = server(managedUrl);
    return { choices: [pinned], active: pinned, managed: true };
  }
  const servers = (Array.isArray(sync.backends) ? sync.backends : [])
    .filter((b) => b && typeof b.url === "string")
    .map((b) => server(b.url));
  const active = servers.find((s) => s.url === sync.active) || LOCAL_BACKEND;
  return { choices: [LOCAL_BACKEND, ...servers], active, managed: false };
}

export const backendId = (b) => (b.kind === "local" ? LOCAL : b.url);

export async function addServer(url) {
  const { backends = [] } = await chrome.storage.sync.get("backends");
  const next = [...backends.filter((b) => b.url !== url), { url }].sort((a, b) => a.url.localeCompare(b.url));
  await chrome.storage.sync.set({ backends: next, active: url });
}

export async function removeServer(url) {
  const { backends = [], active } = await chrome.storage.sync.get(["backends", "active"]);
  await chrome.storage.sync.set({ backends: backends.filter((b) => b.url !== url), active: active === url ? LOCAL : active });
}

export function setActive(id) {
  return chrome.storage.sync.set({ active: id });
}

export const hasServerAccess = (backend) => chrome.permissions.contains({ origins: [`${backend.url}/*`] });

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
    // (An unreachable server looks the same from here.)
    throw Object.assign(new Error("Not signed in."), { status: 401 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null) {
    throw Object.assign(new Error(data?.error || `${backend.label} is not responding like a Cairn server (${res.status}).`), {
      status: res.status === 200 ? 502 : res.status,
    });
  }
  return data;
}

/**
 * Who is signed in to this server: { email } when signed in, { signedOut: true } when Access
 * wants a sign-in (or the server is unreachable), { error } when it is not a Cairn server.
 */
export async function probe(backend) {
  try {
    const me = await api(backend, "GET", "/me");
    return typeof me.email === "string" ? { email: me.email } : { error: `${backend.label} is not a Cairn server.` };
  } catch (err) {
    return err.status === 401 ? { signedOut: true } : { error: err.message };
  }
}
