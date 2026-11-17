import { addServer, backendId, getState, hasServerAccess, normalizeServerUrl, probe, removeServer, setActive } from "./config.js";
import { countLinks } from "./local.js";

const $ = (id) => document.getElementById(id);
const say = (text, isErr = false) => {
  $("msg").textContent = text;
  $("msg").classList.toggle("err", isErr);
};
const el = (tag, props, ...kids) => {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
};
const button = (text, onclick, cls = "quiet") => el("button", { type: "button", className: cls, textContent: text, onclick });

// Must run straight from a click: Chrome only shows the permission prompt for a user gesture.
function requestAccess(url) {
  return chrome.permissions.request({ origins: [`${url}/*`] }).catch(() => false);
}

// Cloudflare Access signs people in on the server's own pages; opening the site starts it.
function signIn(b) {
  chrome.tabs.create({ url: `${b.url}/_/` });
  say(`Sign in to ${b.label} in the tab that just opened. This page updates when you come back.`);
}

const guarded = (fn) => async () => {
  try {
    await fn();
  } catch (err) {
    say(err.message, true);
  }
  render();
};

async function serverStatus(b) {
  if (!(await hasServerAccess(b))) return { text: "Needs permission to reach this server", warn: true, action: "grant" };
  const p = await probe(b);
  if (p.email) {
    // Back from the sign-in tab: replace the "sign in" prompt with the outcome.
    if ($("msg").textContent.startsWith(`Sign in to ${b.label}`)) say(`Signed in to ${b.label} as ${p.email}.`);
    return { text: `Signed in as ${p.email}` };
  }
  if (p.signedOut) return { text: "Not signed in (or not reachable)", warn: true, action: "signin" };
  return { text: p.error, warn: true };
}

async function row(b, state) {
  const isActive = backendId(b) === backendId(state.active);
  const acts = el("div", { className: "acts" });
  let meta;

  if (b.kind === "local") {
    const n = await countLinks();
    meta = { text: `Links are stored only in this Chrome profile · ${n} link${n === 1 ? "" : "s"}` };
    acts.append(button("Manage links", () => chrome.tabs.create({ url: chrome.runtime.getURL("links.html") })));
  } else {
    meta = await serverStatus(b);
    if (meta.action === "grant") {
      acts.append(
        button(
          "Grant access",
          guarded(async () => {
            if (await requestAccess(b.url)) say(`Access granted for ${b.label}.`);
          }),
        ),
      );
    }
    if (meta.action === "signin") acts.append(button("Sign in", () => signIn(b)));
    if (!state.managed) {
      acts.append(
        button(
          "Remove",
          guarded(async () => {
            await removeServer(b.url);
            say(`Removed ${b.label}. Links now come from this browser.`);
          }),
          "quiet danger",
        ),
      );
    }
  }

  const radio = el("input", { type: "radio", name: "active", checked: isActive, disabled: state.managed });
  radio.setAttribute("aria-label", `Use ${b.label}`);
  radio.onchange = guarded(() => setActive(backendId(b)));
  const title = b.kind === "local" ? "This browser (local mode)" : b.url;
  return el(
    "li",
    null,
    radio,
    el("div", { className: "info" }, el("div", { className: "title", textContent: title }), el("div", { className: `meta${meta.warn ? " warn" : ""}`, textContent: meta.text })),
    acts,
  );
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const state = await getState();
  const rows = await Promise.all(state.choices.map((b) => row(b, state)));
  if (seq !== renderSeq) return; // a newer render finished first
  $("list").replaceChildren(...rows);
  $("add-section").hidden = state.managed;
  if (state.managed) $("lead").textContent = "Your organization chose the Cairn server for this browser.";
}

$("add").onsubmit = async (e) => {
  e.preventDefault();
  let url;
  try {
    url = normalizeServerUrl($("server").value);
  } catch (err) {
    return say(err.message, true);
  }
  // Ask first, while the click still counts as a user gesture.
  if (!(await requestAccess(url))) return say(`Cairn needs permission to reach ${new URL(url).host} to use it.`, true);
  $("add-btn").disabled = true;
  try {
    const b = { kind: "server", url, label: new URL(url).host };
    const p = await probe(b);
    if (p.error) return say(p.error, true);
    await addServer(url);
    $("server").value = "";
    if (p.email) say(`Ready, signed in as ${p.email}. Type go/ in the address bar.`);
    else signIn(b);
  } finally {
    $("add-btn").disabled = false;
    render();
  }
};

chrome.storage.onChanged.addListener(render);
// Coming back from the sign-in tab: show the new state.
window.addEventListener("focus", render);
render();
