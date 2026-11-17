import { api, getState, hasServerAccess } from "./config.js";
import { listLinks } from "./local.js";

const REDIRECT_RULE = 1;
const OLD_AUTH_RULE = 2; // from versions that held their own sign-in token; removed on sync

// http(s)://go/<anything> is redirected before any DNS lookup happens:
//   server mode -> <server>/<anything>; Cloudflare Access signs the navigation in.
//   local mode  -> this extension's go.html#<anything>, which looks the link up in local storage.
async function syncRules() {
  const { active } = await getState();
  const target = active.kind === "local" ? `chrome-extension://${chrome.runtime.id}/go.html#\\1` : `${active.url}/\\1`;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE, OLD_AUTH_RULE],
    addRules: [
      {
        id: REDIRECT_RULE,
        priority: 1,
        action: { type: "redirect", redirect: { regexSubstitution: target } },
        condition: { regexFilter: "^https?://go/(.*)$", resourceTypes: ["main_frame"] },
      },
    ],
  });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // Earlier versions stored sign-in tokens here; Cloudflare Access replaces them.
  await chrome.storage.local.remove("tokens");
  await syncRules();
  if (reason === "install") chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(syncRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.backends || changes.active)) syncRules();
});

// Address bar: "go<space>name".
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim();
  if (!q) return;
  const { active } = await getState();
  try {
    let links;
    if (active.kind === "local") links = await listLinks(q, 6);
    else if (await hasServerAccess(active)) links = (await api(active, "GET", `/links?limit=6&q=${encodeURIComponent(q)}`)).links;
    else return;
    suggest(
      links.map((l) => ({
        content: l.slug,
        description: `<match>go/${escapeXml(l.slug)}</match> <dim>${escapeXml(l.description || l.url)}</dim>`,
      })),
    );
  } catch {
    // Signed out or offline: suggestions are a nicety, Enter still works.
  }
});

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // "go jira ABC-1" behaves like go/jira/ABC-1; the redirect rule takes it from there.
  const url = `http://go/${text.trim().split(/\s+/).map(encodeURIComponent).join("/")}`;
  if (disposition === "currentTab") chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
});
