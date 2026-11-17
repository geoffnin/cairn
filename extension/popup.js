import { api, getState, hasServerAccess, setActive } from "./config.js";

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
let state = getState();

// The website's form does the same job; used when we cannot call the API from here
// (no host access granted, or the user needs to sign in first).
const continueOnSite = (backend) =>
  openTab(`${backend.url}/_/?${new URLSearchParams({ new: $("slug").value.trim(), url: $("url").value.trim() })}`);

$("browse").onclick = async (e) => {
  e.preventDefault();
  const { active } = await state;
  if (active) openTab(`${active.url}/_/`);
};

$("form").onsubmit = async (e) => {
  e.preventDefault();
  const { active, token } = await state;
  if (!active) return;
  if (!(await hasServerAccess(active))) return continueOnSite(active);
  $("submit").disabled = true;
  say("");
  try {
    const link = await api(active, token, "POST", "/links", {
      slug: $("slug").value,
      url: $("url").value,
      description: $("desc").value,
    });
    const short = `${active.prefix}/${link.slug}`;
    await navigator.clipboard.writeText(short).catch(() => {});
    say(`Created ${short} and copied it to the clipboard.`);
    $("slug").value = $("url").value = $("desc").value = "";
  } catch (err) {
    // 401 = signed out; no status = network/CORS failure. Either way the site can take over.
    if (err.status === 401 || err.status === undefined) return continueOnSite(active);
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

function render({ backends, active, managed }) {
  if (!active) {
    $("form").hidden = true;
    say("Add your Cairn server to get started.");
    chrome.runtime.openOptionsPage();
    return;
  }
  $("prefix").textContent = `${active.prefix}/`;
  $("backend-row").hidden = managed || backends.length < 2;
  $("backend").replaceChildren(...backends.map((b) => new Option(new URL(b.url).host, b.url, false, b.url === active.url)));
}

chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.url && /^https?:/.test(tab.url) && !$("url").value) $("url").value = tab.url;
});
state.then(render);
