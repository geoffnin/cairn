import { api, getState, hasServerAccess, migrateSettings } from "./config.js";
import { ext } from "./ext.js";
import { omniboxPath } from "./golinks.js";
import { listLinks } from "./local.js";

const REDIRECT_RULE = 1;
const OLD_AUTH_RULE = 2; // from versions that held their own sign-in token; removed on sync
const SEARCH_RULE = 3;

// A search for "go/<anything>" on the default search engines (Google, Bing, DuckDuckGo): the
// address bar sends a typed go/name there until the browser knows `go` as a host. The query
// value is still URL-encoded, so go.html decodes it and goes on to http://go/<anything>.
const SEARCH_FILTER =
  "^https://(?:www\\.google\\.com/search|www\\.bing\\.com/search|duckduckgo\\.com/)\\?(?:[^#]*&)?q=go(?:%2[Ff]|/)([^&#]*)";

// http(s)://go/<anything> is redirected before any DNS lookup happens:
//   shared mode -> <server>/<anything>; Cloudflare Access signs the navigation in.
//   local mode  -> this extension's go.html#<anything>, which looks the link up in local storage.
async function syncRules() {
  const { active } = await getState();
  const go = ext.runtime.getURL("go.html");
  const target = active.kind === "local" ? `${go}#\\1` : `${active.url}/\\1`;
  await ext.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [REDIRECT_RULE, OLD_AUTH_RULE, SEARCH_RULE],
    addRules: [
      {
        id: REDIRECT_RULE,
        priority: 1,
        action: { type: "redirect", redirect: { regexSubstitution: target } },
        condition: { regexFilter: "^https?://go/(.*)$", resourceTypes: ["main_frame"] },
      },
      {
        id: SEARCH_RULE,
        priority: 1,
        action: { type: "redirect", redirect: { regexSubstitution: `${go}?search=\\1` } },
        condition: { regexFilter: SEARCH_FILTER, resourceTypes: ["main_frame"] },
      },
    ],
  });
}

ext.runtime.onInstalled.addListener(async ({ reason }) => {
  // Earlier versions stored sign-in tokens here; Cloudflare Access replaces them.
  await ext.storage.local.remove("tokens");
  await migrateSettings();
  await syncRules();
  if (reason === "install") ext.runtime.openOptionsPage();
});
ext.runtime.onStartup.addListener(syncRules);
ext.storage.onChanged.addListener((changes, area) => {
  if ((area === "sync" && (changes.mode || changes.serverUrl)) || area === "managed") syncRules();
});

// Address bar: "go<space>name".
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

ext.omnibox?.onInputChanged.addListener(async (text, suggest) => {
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
        // Firefox shows descriptions as plain text; Chrome and Edge style the XML markup.
        description:
          __TARGET__ === "firefox"
            ? `go/${l.slug} — ${l.description || l.url}`
            : `<match>go/${escapeXml(l.slug)}</match> <dim>${escapeXml(l.description || l.url)}</dim>`,
      })),
    );
  } catch {
    // Signed out or offline: suggestions are a nicety, Enter still works.
  }
});

ext.omnibox?.onInputEntered.addListener((text, disposition) => {
  // "go jira ABC-1" behaves like go/jira/ABC-1; the redirect rule takes it from there.
  const url = `http://go/${omniboxPath(text)}`;
  if (disposition === "currentTab") ext.tabs.update({ url });
  else ext.tabs.create({ url, active: disposition === "newForegroundTab" });
});
