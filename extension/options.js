import {
  api,
  fetchServerConfig,
  getState,
  hasAllAccess,
  normalizeServerUrl,
  originsFor,
  removeBackend,
  saveBackend,
  setActive,
  setToken,
} from "./config.js";
import { signIn } from "./signin.js";

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

// Chrome only shows a permission prompt in direct response to a click, so this is called from
// click handlers (after at most one quick request to the server).
async function grant(backend) {
  try {
    return await chrome.permissions.request({ origins: originsFor(backend) });
  } catch {
    throw new Error("Chrome did not show the permission prompt. Please click again.");
  }
}

/** Grant access if needed, then sign in (when the server uses its own sign-in). */
async function connect(backend) {
  if (!(await grant(backend))) {
    say(`Without permission the extension cannot sign in to ${new URL(backend.url).host} or redirect ${backend.prefix}/ links.`, true);
    return;
  }
  if (backend.auth !== "oidc") return say(`Ready. Type ${backend.prefix}/ in the address bar.`);
  say("Finish signing in on the tab that just opened…");
  const email = await signIn(backend);
  say(`Signed in as ${email}. Type ${backend.prefix}/ in the address bar.`);
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
  const { tokens = {} } = await chrome.storage.local.get("tokens");
  const saved = tokens[backend.url];
  const signedIn = saved && saved.expires_at * 1000 > Date.now();
  const access = await hasAllAccess(backend);

  let status = `Links start with ${backend.prefix}/`;
  let warn = false;
  if (!access) [status, warn] = [`Needs permission to redirect ${backend.prefix}/ links`, true];
  else if (backend.auth !== "oidc") status += " · sign-in is handled by your network";
  else if (signedIn) status += ` · signed in as ${saved.email}`;
  else [status, warn] = [`${status} · not signed in`, true];

  const radio = el("input", { type: "radio", name: "active", checked: isActive, disabled: state.managed });
  radio.setAttribute("aria-label", `Use ${backend.url}`);
  radio.onchange = guarded(() => setActive(backend.url));

  const acts = el("div", { className: "acts" });
  if (!access) acts.append(button("Grant access", guarded(() => connect(backend))));
  else if (backend.auth === "oidc" && !signedIn) acts.append(button("Sign in", guarded(() => connect(backend))));
  else if (signedIn) {
    acts.append(
      button(
        "Sign out",
        guarded(async () => {
          await api(backend, saved, "DELETE", "/tokens/current").catch(() => {});
          await setToken(backend.url, null);
          say(`Signed out of ${new URL(backend.url).host}.`);
        }),
      ),
    );
  }
  if (!state.managed) {
    acts.append(
      button(
        "Remove",
        guarded(async () => {
          if (signedIn) await api(backend, saved, "DELETE", "/tokens/current").catch(() => {});
          await removeBackend(backend.url);
          say(`Removed ${new URL(backend.url).host}.`);
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

async function render() {
  const state = await getState();
  const rows = await Promise.all(state.backends.map((b) => row(b, state)));
  $("list").replaceChildren(...(rows.length ? rows : [el("li", { className: "empty", textContent: "No servers yet. Add one below." })]));
  $("add-section").hidden = state.managed;
  if (state.managed) $("lead").textContent = "Your organization chose the Cairn server for this browser. Sign in once below.";
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

// Under policy, learn the pinned server's prefix so the "Grant access" button asks for the right thing.
const initial = await getState();
if (initial.managed && initial.active) {
  await fetchServerConfig(initial.active.url).then((b) => saveBackend(b), () => {});
}
chrome.storage.onChanged.addListener(render);
render();
