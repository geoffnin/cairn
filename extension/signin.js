// One-time sign-in. Opens the server's consent page in a tab, waits for it to finish, and swaps
// the resulting code (plus a secret only this page knows) for a long-lived token.
import { setToken } from "./config.js";

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function waitForCode(tabId, doneUrl) {
  return new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      fn(value);
    };
    const onUpdated = (id, change) => {
      if (id !== tabId || !change.url?.startsWith(doneUrl)) return;
      const code = new URLSearchParams(new URL(change.url).hash.slice(1)).get("code");
      chrome.tabs.remove(tabId).catch(() => {});
      code ? finish(resolve, code) : finish(reject, new Error("Sign-in did not complete."));
    };
    const onRemoved = (id) => {
      if (id === tabId) finish(reject, new Error("Sign-in was cancelled."));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
  });
}

/** Requires host access to backend.url (to see the tab's address and call the token endpoint). */
export async function signIn(backend) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const tab = await chrome.tabs.create({ url: `${backend.url}/_/auth/extension?challenge=${challenge}` });
  const code = await waitForCode(tab.id, `${backend.url}/_/auth/extension/done`);

  const res = await fetch(`${backend.url}/_/auth/extension/token`, {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, verifier }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new Error(data.error || `Sign-in failed (${res.status}).`);
  await setToken(backend.url, { token: data.token, email: data.email, expires_at: data.expires_at });
  return data.email;
}
