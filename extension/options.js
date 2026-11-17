import { LOCAL, SHARED, getState, hasServerAccess, normalizeServerUrl, probe, setMode, setServer } from "./config.js";
import { countLinks } from "./local.js";
import { say as sayIn } from "./ui/status.js";

const $ = (id) => document.getElementById(id);
const say = (text, isErr = false) => sayIn($("msg"), text, isErr);
const button = (text, onclick) => Object.assign(document.createElement("button"), { type: "button", className: "cn-btn", textContent: text, onclick });

// Must run straight from a click: Chrome only shows the permission prompt for a user gesture.
function requestAccess(url) {
  return chrome.permissions.request({ origins: [`${url}/*`] }).catch(() => false);
}

// Cloudflare Access signs people in on the server's own pages; opening the site starts it.
function signIn(srv) {
  chrome.tabs.create({ url: `${srv.url}/_/` });
  say(`Sign in to ${srv.label} in the tab that just opened. This page updates when you come back.`);
}

async function sharedStatus(srv) {
  if (!(await hasServerAccess(srv))) return { text: "Needs permission to reach this server.", warn: true, action: "grant" };
  const p = await probe(srv);
  if (p.email) {
    // Back from the sign-in tab: replace the "sign in" prompt with the outcome.
    if ($("msg").textContent.startsWith(`Sign in to ${srv.label}`)) say(`Signed in to ${srv.label} as ${p.email}.`);
    return { text: `Signed in as ${p.email}.` };
  }
  if (p.signedOut) return { text: "Not signed in (or the server is not reachable).", warn: true, action: "signin" };
  return { text: p.error, warn: true };
}

let renderSeq = 0;
let current = null; // state as last shown, so clicks can respond without waiting on storage

async function render() {
  const seq = ++renderSeq;
  const state = await getState();
  const n = state.managed ? 0 : await countLinks();
  const status = state.server ? await sharedStatus(state.server) : null;
  if (seq !== renderSeq) return; // a newer render finished first
  current = state;

  $("local-choice").hidden = state.managed;
  $("local-meta").textContent = `Stored only in this Chrome profile, not shared or synced · ${n} link${n === 1 ? "" : "s"}`;
  $("mode-local").checked = state.mode === LOCAL;
  $("mode-shared").checked = state.mode === SHARED;
  $("mode-shared").disabled = state.managed;

  if (document.activeElement !== $("server")) $("server").value = state.server?.url ?? "";
  $("server").disabled = $("save").disabled = state.managed;
  $("save").hidden = state.managed;
  if (state.managed) $("lead").textContent = "Your organization set up shared links for this browser.";

  $("shared-meta").textContent = status?.text ?? "";
  $("shared-meta").classList.toggle("is-error", !!status?.warn);
  const acts = [];
  if (status?.action === "grant") {
    acts.push(button("Grant access", async () => {
      if (await requestAccess(state.server.url)) say(`Access granted for ${state.server.label}.`);
      render();
    }));
  }
  if (status?.action === "signin") acts.push(button("Sign in", () => signIn(state.server)));
  $("shared-acts").replaceChildren(...acts);
}

$("manage").onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("links.html") });
$("mode-local").onchange = () => setMode(LOCAL).then(render);
$("mode-shared").onchange = () => {
  if (current?.server) return setMode(SHARED).then(render);
  // Nothing to switch to yet: keep local mode until a server is saved.
  $("mode-local").checked = true;
  $("server").focus();
  say("Enter your company's Cairn server address, then choose Use this server.");
};

$("server-form").onsubmit = async (e) => {
  e.preventDefault();
  let url;
  try {
    url = normalizeServerUrl($("server").value);
  } catch (err) {
    return say(err.message, true);
  }
  // Ask first, while the click still counts as a user gesture.
  if (!(await requestAccess(url))) return say(`Cairn needs permission to reach ${new URL(url).host} to use it.`, true);
  $("save").disabled = true;
  try {
    const srv = { kind: "server", url, label: new URL(url).host };
    const p = await probe(srv);
    if (p.error) return say(p.error, true);
    await setServer(url);
    $("server").blur();
    if (p.email) say(`Using ${srv.label}, signed in as ${p.email}. Type go/ in the address bar.`);
    else signIn(srv);
  } finally {
    $("save").disabled = false;
    render();
  }
};

// Display: theme and density take effect at once, on every extension page (ui/display.js).
const DISPLAY_KEY = "cairn.display";
function readDisplay() {
  try {
    return { theme: "system", density: "default", ...JSON.parse(localStorage.getItem(DISPLAY_KEY)) };
  } catch {
    return { theme: "system", density: "default" };
  }
}
function showDisplay(prefs) {
  const html = document.documentElement;
  if (prefs.theme === "system") delete html.dataset.theme;
  else html.dataset.theme = prefs.theme;
  if (prefs.density === "default") delete html.dataset.density;
  else html.dataset.density = prefs.density;
  for (const key of ["theme", "density"]) {
    for (const b of $(key).querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.value === prefs[key]));
  }
}
for (const key of ["theme", "density"]) {
  $(key).onclick = (e) => {
    const value = e.target.closest("button")?.value;
    if (!value) return;
    const prefs = { ...readDisplay(), [key]: value };
    try {
      localStorage.setItem(DISPLAY_KEY, JSON.stringify(prefs));
    } catch {}
    showDisplay(prefs);
  };
}
// Another settings tab changed them.
window.addEventListener("storage", (e) => e.key === DISPLAY_KEY && showDisplay(readDisplay()));
showDisplay(readDisplay());

chrome.storage.onChanged.addListener(render);
// Coming back from the sign-in tab: show the new state.
window.addEventListener("focus", render);
render();
