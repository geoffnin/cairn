import { getConfig, normalizeServerUrl } from "./config.js";

const $ = (id) => document.getElementById(id);
const say = (text, isErr = false) => {
  $("msg").textContent = text;
  $("msg").classList.toggle("err", isErr);
};

const { serverUrl, source } = await getConfig();
if (serverUrl) $("server").value = serverUrl;
if (source === "managed") {
  $("server").disabled = true;
  $("save").hidden = true;
  $("hint").textContent = "This setting is managed by your organization.";
}

$("form").onsubmit = async (e) => {
  e.preventDefault();
  let url;
  try {
    url = normalizeServerUrl($("server").value);
  } catch (err) {
    return say(err.message, true);
  }
  // Must be requested straight from the click. Lets the popup and address-bar suggestions
  // call the server; redirects work without it.
  const granted = await chrome.permissions.request({ origins: [`${url}/*`] }).catch(() => false);
  await chrome.storage.sync.set({ serverUrl: url });
  $("server").value = url;
  say(
    granted
      ? "Saved. Try go/ in the address bar."
      : "Saved. Redirects work; creating links from the toolbar button will open the website instead.",
  );
};
