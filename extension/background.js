import { api, getConfig, hasServerAccess } from "./config.js";

const RULE_ID = 1;

// http(s)://go/<anything>  ->  <server>/<anything>, before any DNS lookup happens.
async function syncRedirectRule() {
  const { serverUrl } = await getConfig();
  const addRules = serverUrl
    ? [
        {
          id: RULE_ID,
          priority: 1,
          action: { type: "redirect", redirect: { regexSubstitution: `${serverUrl}/\\1` } },
          condition: { regexFilter: "^https?://go/(.*)$", resourceTypes: ["main_frame"] },
        },
      ]
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID], addRules });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await syncRedirectRule();
  if (reason === "install" && !(await getConfig()).serverUrl) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(syncRedirectRule);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) syncRedirectRule();
});

// Address bar: "go<space>name".
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const q = text.trim();
  const { serverUrl } = await getConfig();
  if (!q || !serverUrl || !(await hasServerAccess(serverUrl))) return;
  try {
    const { links } = await api(serverUrl, "GET", `/links?limit=6&q=${encodeURIComponent(q)}`);
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

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const { serverUrl } = await getConfig();
  if (!serverUrl) return chrome.runtime.openOptionsPage();
  // "go jira ABC-1" behaves like go/jira/ABC-1.
  const url = `${serverUrl}/${text.trim().split(/\s+/).map(encodeURIComponent).join("/")}`;
  if (disposition === "currentTab") chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
});
