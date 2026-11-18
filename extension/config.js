// Where links live, and talking to the Cairn server.
//
//   storage.sync    mode:      "local" | "shared"
//                   serverUrl: the company's Cairn server, used in shared mode
//   storage.managed serverUrl  set by policy; forces shared mode with that server
//
// Local mode keeps links in this browser (local.js). Shared mode uses one Cairn server behind
// Cloudflare Access. The extension holds no credentials: the browser's Access session signs in
// redirects and API calls.

import { normalizeServerUrl, serverAuthenticationUrl } from "../ui/src/lib/server.js";
export { normalizeServerUrl, serverAuthenticationUrl };

export const LOCAL = "local";
export const SHARED = "shared";
/** @type {LocalBackend} */
export const LOCAL_BACKEND = Object.freeze({ kind: "local", label: "This browser" });
/** @returns {ServerBackend} */
const server = (url) => ({ kind: "server", url, label: new URL(url).host });

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

/** @typedef {{ kind: "local", label: string }} LocalBackend */
/** @typedef {{ kind: "server", url: string, label: string }} ServerBackend */
/** @typedef {LocalBackend | ServerBackend} Backend */

/**
 * @returns {Promise<{ mode: string, server: ServerBackend|null, active: Backend, choices: Backend[], managed: boolean }>}
 * `choices` is what the popup can switch between: this browser, plus the server once one is set.
 */
export async function getState() {
  const [managedUrl, sync] = await Promise.all([managedServerUrl(), chrome.storage.sync.get(["mode", "serverUrl"])]);
  if (managedUrl) {
    const pinned = server(managedUrl);
    return { mode: SHARED, server: pinned, active: pinned, choices: [pinned], managed: true };
  }
  let srv = null;
  try {
    srv = sync.serverUrl ? server(normalizeServerUrl(sync.serverUrl)) : null;
  } catch {
    /* ignore a bad stored value */
  }
  const mode = sync.mode === SHARED && srv ? SHARED : LOCAL;
  return { mode, server: srv, active: mode === SHARED ? srv : LOCAL_BACKEND, choices: srv ? [LOCAL_BACKEND, srv] : [LOCAL_BACKEND], managed: false };
}

export const backendId = (b) => (b.kind === "local" ? LOCAL : SHARED);

/** Save the shared server. Autosave can leave mode unchanged until the current choice is checked. */
export function setServer(url, activate = true) {
  return chrome.storage.sync.set(activate ? { serverUrl: url, mode: SHARED } : { serverUrl: url });
}

export function setMode(mode) {
  return chrome.storage.sync.set({ mode: mode === SHARED ? SHARED : LOCAL });
}

/**
 * Versions 0.2-0.4 kept a list of servers ({ backends, active }). Keep the one in use (or the
 * first) as the shared server, and the mode that was in effect.
 */
export async function migrateSettings() {
  const old = await chrome.storage.sync.get(["backends", "active", "serverUrl"]);
  if (!Array.isArray(old.backends)) return;
  const urls = old.backends.map((b) => b?.url).filter((u) => typeof u === "string");
  const chosen = urls.includes(old.active) ? old.active : urls[0];
  const update = { mode: urls.includes(old.active) ? SHARED : LOCAL };
  if (chosen && !old.serverUrl) update.serverUrl = chosen;
  await chrome.storage.sync.set(update);
  await chrome.storage.sync.remove(["backends", "active"]);
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
