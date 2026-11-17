import { api, fetchServerConfig, getState, hasServerAccess, saveBackend } from "./config.js";

const REDIRECT_RULE = 1;
const AUTH_RULE = 2;

// Rule 1: http(s)://<prefix>/<anything> -> <server>/<anything>, before any DNS lookup happens.
// Rule 2: attach the extension's sign-in to requests for that server, so the person who signed
//         in once from the settings page is signed in for redirects and the website too.
async function syncRules() {
  const { active, token } = await getState();
  const addRules = [];
  if (active) {
    addRules.push({
      id: REDIRECT_RULE,
      priority: 1,
      action: { type: "redirect", redirect: { regexSubstitution: `${active.url}/\\1` } },
      condition: { regexFilter: `^https?://${active.prefix}/(.*)$`, resourceTypes: ["main_frame"] },
    });
    if (token) {
      addRules.push({
        id: AUTH_RULE,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "authorization", operation: "set", value: `Bearer ${token.token}` }],
        },
        condition: { urlFilter: `|${active.url}/`, resourceTypes: ["main_frame", "xmlhttprequest"] },
      });
    }
  }
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [REDIRECT_RULE, AUTH_RULE], addRules });
}

// Servers can change their prefix; pick that up without the user doing anything.
async function refreshActiveBackend() {
  const { active, managed } = await getState();
  if (!active) return;
  try {
    const fresh = await fetchServerConfig(active.url);
    if (fresh.prefix !== active.prefix || fresh.auth !== active.auth) await saveBackend(fresh, { makeActive: !managed });
  } catch {
    // Offline or server down: keep what we have.
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await syncRules();
  if (reason === "install" && !(await getState()).active) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(async () => {
  await syncRules();
  await refreshActiveBackend();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.backends || changes.active || changes.tokens || changes.serverUrl) syncRules();
});

// Address bar: "go<space>name".
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim();
  const { active, token } = await getState();
  if (!q || !active || !(await hasServerAccess(active))) return;
  try {
    const { links } = await api(active, token, "GET", `/links?limit=6&q=${encodeURIComponent(q)}`);
    suggest(
      links.map((l) => ({
        content: l.slug,
        description: `<match>${active.prefix}/${escapeXml(l.slug)}</match> <dim>${escapeXml(l.description || l.url)}</dim>`,
      })),
    );
  } catch {
    // Signed out or offline: suggestions are a nicety, Enter still works.
  }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const { active } = await getState();
  if (!active) return chrome.runtime.openOptionsPage();
  // "go jira ABC-1" behaves like go/jira/ABC-1.
  const url = `${active.url}/${text.trim().split(/\s+/).map(encodeURIComponent).join("/")}`;
  if (disposition === "currentTab") chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
});
