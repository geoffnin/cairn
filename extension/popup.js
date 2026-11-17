import { api, getConfig, hasServerAccess } from "./config.js";

const $ = (id) => document.getElementById(id);
const say = (text, isErr = false) => {
  $("msg").textContent = text;
  $("msg").classList.toggle("err", isErr);
};
const openTab = (url) => {
  chrome.tabs.create({ url });
  window.close();
};

// Handlers are attached before anything is awaited so an early click is never lost.
const config = getConfig();

// The website's form does the same job; used when we cannot call the API from here
// (no host access granted, or the user needs to sign in first).
const continueOnSite = (serverUrl) =>
  openTab(`${serverUrl}/_/?${new URLSearchParams({ new: $("slug").value.trim(), url: $("url").value.trim() })}`);

$("browse").onclick = async (e) => {
  e.preventDefault();
  const { serverUrl } = await config;
  if (serverUrl) openTab(`${serverUrl}/_/`);
};

$("form").onsubmit = async (e) => {
  e.preventDefault();
  const { serverUrl } = await config;
  if (!serverUrl) return;
  if (!(await hasServerAccess(serverUrl))) return continueOnSite(serverUrl);
  $("submit").disabled = true;
  say("");
  try {
    const link = await api(serverUrl, "POST", "/links", {
      slug: $("slug").value,
      url: $("url").value,
      description: $("desc").value,
    });
    await navigator.clipboard.writeText(`go/${link.slug}`).catch(() => {});
    say(`Created go/${link.slug} and copied it to the clipboard.`);
    $("form").reset();
  } catch (err) {
    // 401 = signed out; no status = network/CORS failure. Either way the site can take over.
    if (err.status === 401 || err.status === undefined) return continueOnSite(serverUrl);
    say(err.message, true);
  } finally {
    $("submit").disabled = false;
  }
};

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.url && /^https?:/.test(tab.url) && !$("url").value) $("url").value = tab.url;
});

config.then(({ serverUrl }) => {
  if (serverUrl) return;
  $("form").hidden = true;
  say("Set your Cairn server URL to get started.");
  chrome.runtime.openOptionsPage();
});
