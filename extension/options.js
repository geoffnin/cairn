import {
  fetchServerConfig,
  getState,
  hasAllAccess,
  normalizeServerUrl,
  originsFor,
  removeBackend,
  saveBackend,
  setActive,
  whoAmI,
} from "./config.js";

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
const host = (backend) => new URL(backend.url).host;

// Chrome only shows a permission prompt in direct response to a click, so this is called from
// click handlers (after at most one quick request to the server).
async function grant(backend) {
  try {
    return await chrome.permissions.request({ origins: originsFor(backend) });
  } catch {
    throw new Error("Chrome did not show the permission prompt. Please click again.");
  }
}

// Signing in is done by Cloudflare Access on the server's own pages; opening the site starts it.
// Access remembers the session for as long as its application allows (up to a month).
function signIn(backend) {
  chrome.tabs.create({ url: `${backend.url}/_/` });
  say(`Sign in to ${host(backend)} in the tab that just opened. This page updates when you come back.`);
}

async function connect(backend) {
  if (!(await grant(backend))) {
    say(`Without permission the extension cannot redirect ${backend.prefix}/ links to ${host(backend)}.`, true);
    return;
  }
  const email = await whoAmI(backend);
  if (email) say(`Ready, signed in as ${email}. Type ${backend.prefix}/ in the address bar.`);
  else signIn(backend);
}

const guarded = (fn) => async () => {
  try {
    await fn();
  } catch (err) {
    say(err.message, true);
  }
  render();
};

async function row(backend, state) {
  const isActive = state.active?.url === backend.url;
  const access = await hasAllAccess(backend);
  const email = access ? await whoAmI(backend) : null;

  let status = `Links start with ${backend.prefix}/`;
  let warn = false;
  if (!access) [status, warn] = [`Needs permission to redirect ${backend.prefix}/ links`, true];
  else if (email) status += ` · signed in as ${email}`;
  else [status, warn] = [`${status} · not signed in`, true];

  const radio = el("input", { type: "radio", name: "active", checked: isActive, disabled: state.managed });
  radio.setAttribute("aria-label", `Use ${backend.url}`);
  radio.onchange = guarded(() => setActive(backend.url));

  const acts = el("div", { className: "acts" });
  if (!access) acts.append(button("Grant access", guarded(() => connect(backend))));
  else if (!email) acts.append(button("Sign in", guarded(async () => signIn(backend))));
  if (!state.managed) {
    acts.append(
      button(
        "Remove",
        guarded(async () => {
          await removeBackend(backend.url);
          say(`Removed ${host(backend)}.`);
        }),
        "quiet danger",
      ),
    );
  }

  return el(
    "li",
    null,
    radio,
    el("div", { className: "info" }, el("div", { className: "host", textContent: backend.url }), el("div", { className: `meta${warn ? " warn" : ""}`, textContent: status })),
    acts,
  );
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const state = await getState();
  const rows = await Promise.all(state.backends.map((b) => row(b, state)));
  if (seq !== renderSeq) return; // a newer render finished first
  $("list").replaceChildren(...(rows.length ? rows : [el("li", { className: "empty", textContent: "No servers yet. Add one below." })]));
  $("add-section").hidden = state.managed;
  if (state.managed) $("lead").textContent = "Your organization chose the Cairn server for this browser.";
  const p = state.active?.prefix;
  $("usage").textContent = p
    ? `Type ${p}/name in the address bar to open a link. Typing "go", then space, searches link names.`
    : "";
}

$("add").onsubmit = async (e) => {
  e.preventDefault();
  $("add-btn").disabled = true;
  try {
    const backend = await fetchServerConfig(normalizeServerUrl($("server").value));
    await saveBackend(backend, { makeActive: true });
    $("server").value = "";
    await render();
    await connect(backend);
  } catch (err) {
    say(err.message, true);
  } finally {
    $("add-btn").disabled = false;
    render();
  }
};

// Under policy, learn the pinned server's prefix so "Grant access" asks for the right thing.
const initial = await getState();
if (initial.managed && initial.active) {
  await fetchServerConfig(initial.active.url).then((b) => saveBackend(b), () => {});
}
chrome.storage.onChanged.addListener(render);
// Coming back from the sign-in tab: show the new state.
window.addEventListener("focus", render);
render();
