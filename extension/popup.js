import { api, backendId, getState, hasServerAccess, setActive } from "./config.js";
import { createLink } from "./local.js";

const $ = (id) => document.getElementById(id);
const say = (text, isErr = false) => {
  $("msg").textContent = text;
  $("msg").classList.toggle("err", isErr);
};
const openTab = (url) => {
  chrome.tabs.create({ url });
  window.close();
};
const fields = () => ({ slug: $("slug").value, url: $("url").value, description: $("desc").value });

// Handlers are attached before anything is awaited so an early click is never lost.
let state = getState();

const allLinksUrl = (b) => (b.kind === "local" ? chrome.runtime.getURL("links.html") : `${b.url}/_/`);

// The server's own form does the same job; used when the API cannot be called from here
// (no host access granted, or the person needs to sign in to Cloudflare Access first).
const continueOnSite = (b) =>
  openTab(`${b.url}/_/?${new URLSearchParams({ new: $("slug").value.trim(), url: $("url").value.trim() })}`);

$("browse").onclick = async (e) => {
  e.preventDefault();
  openTab(allLinksUrl((await state).active));
};

$("form").onsubmit = async (e) => {
  e.preventDefault();
  const { active } = await state;
  if (active.kind === "server" && !(await hasServerAccess(active))) return continueOnSite(active);
  $("submit").disabled = true;
  say("");
  try {
    const link = active.kind === "local" ? await createLink(fields()) : await api(active, "POST", "/links", fields());
    await navigator.clipboard.writeText(`go/${link.slug}`).catch(() => {});
    say(`Created go/${link.slug} and copied it to the clipboard.`);
    $("slug").value = $("url").value = $("desc").value = "";
  } catch (err) {
    // Signed out of Access: the website can take over, and loading it signs the person in.
    if (active.kind === "server" && err.status === 401) return continueOnSite(active);
    say(err.message, true);
  } finally {
    $("submit").disabled = false;
  }
};

$("backend").onchange = async () => {
  await setActive($("backend").value);
  state = getState();
  render(await state);
};

function render({ choices, active }) {
  // A choice only makes sense once there is more than one place to save to.
  $("backend-row").hidden = choices.length < 2;
  $("backend").replaceChildren(...choices.map((b) => new Option(b.label, backendId(b), false, backendId(b) === backendId(active))));
  $("where").textContent = choices.length < 2 ? (active.kind === "local" ? "Saved in this browser." : `Saved to ${active.label}.`) : "";
}

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.url && /^https?:/.test(tab.url) && !$("url").value) $("url").value = tab.url;
});
state.then(render);
