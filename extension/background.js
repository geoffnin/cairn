import { api, getState, hasServerAccess, migrateSettings } from "./config.js";
import { ext } from "./ext.js";
import { omniboxPath } from "./golinks.js";
import { listLinks } from "./local.js";

const REDIRECT_RULE = 1;
const OLD_AUTH_RULE = 2; // from versions that held their own sign-in token; removed on sync

// http(s)://go/<anything> is redirected before any DNS lookup happens:
//   shared mode -> <server>/<anything>; Cloudflare Access signs the navigation in.
//   local mode  -> this extension's go.html#<anything>, which looks the link up in local storage.
async function syncRules() {
  const { active } = await getState();
  const target = active.kind === "local" ? `${ext.runtime.getURL("go.html")}#\\1` : `${active.url}/\\1`;
  await ext.declarativeNetRequest.updateDynamicRules({
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
