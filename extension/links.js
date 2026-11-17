import { createLink, deleteLink, listLinks, updateLink } from "./local.js";
import { say as sayIn } from "./ui/status.js";

const $ = (id) => document.getElementById(id);
const say = (id, text, isErr = false) => sayIn($(id), text, isErr);
const el = (tag, props, ...kids) => {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
};

let editing = null;
// The link just created or edited: its row settles in with the terracotta marker. Kept for the
// length of the fade, since the storage listener re-renders the list right after a save too.
let fresh = null;
let freshTimer;
function markFresh(slug) {
  fresh = slug;
  clearTimeout(freshTimer);
  freshTimer = setTimeout(() => (fresh = null), 2000);
}

// A destination as people read it: scheme dropped, host in ink, the rest muted.
function destination(url) {
  const m = /^https?:\/\/([^/?#]+)(.*)$/i.exec(url);
  const d = el("span", { className: "cn-dest", title: url });
  if (m) d.append(el("span", { className: "cn-host", textContent: m[1] }), m[2]);
  else d.textContent = url;
  return d;
}

function row(l) {
  const edit = el("button", { type: "button", className: "cn-btn is-small is-quiet", textContent: "Edit" });
  edit.onclick = () => {
    editing = l.slug;
    say("e-title", `Edit go/${l.slug}`);
    $("e-url").value = l.url;
    $("e-desc").value = l.description;
    say("e-msg", "", true);
    $("edit").showModal();
  };
  const del = el("button", { type: "button", className: "cn-btn is-small is-danger", textContent: "Delete" });
  del.onclick = async () => {
    if (!confirm(`Delete go/${l.slug}?`)) return;
    await deleteLink(l.slug);
    say("l-msg", `Deleted go/${l.slug}.`);
    load();
  };
  const name = el("td", null,
    // Straight to the local resolver: http://go/... would follow whichever mode is active.
    el("a", { className: "cn-go is-link", href: chrome.runtime.getURL(`go.html#${encodeURIComponent(l.slug)}`), textContent: l.slug, title: l.description }),
  );
  if (l.description) name.append(el("span", { className: "cn-desc", textContent: l.description }));
  return el("tr", { className: l.slug === fresh ? "cn-row is-new" : "cn-row" }, name, el("td", null, destination(l.url)), el("td", { className: "cn-actions" }, edit, del));
}

function empty(q) {
  const cell = el("td", { colSpan: 3 });
  if (q) {
    cell.append(el("div", { className: "cn-empty", textContent: `No links match “${q}”.` }));
  } else {
    // The mark is the only picture in the product; reuse the header's copy.
    const mark = document.querySelector(".cn-header .cn-mark").cloneNode(true);
    cell.append(el("div", { className: "cn-empty" }, mark, el("div", { textContent: "No links yet. Make the first one." })));
  }
  return el("tr", null, cell);
}

let seq = 0;
async function load() {
  const q = $("q").value.trim();
  const id = ++seq;
  const links = await listLinks(q);
  if (id !== seq) return; // a newer load finished first
  $("rows").replaceChildren(...(links.length ? links.map(row) : [empty(q)]));
}

$("new").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const l = await createLink({ slug: $("n-slug").value, url: $("n-url").value, description: $("n-desc").value });
    say("n-msg", `Created go/${l.slug}.`);
    e.target.reset();
    $("n-slug").focus();
    history.replaceState(null, "", "links.html");
    markFresh(l.slug);
    load();
  } catch (err) {
    say("n-msg", err.message, true);
  }
};

$("e-cancel").onclick = () => $("edit").close();
$("e-form").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await updateLink(editing, { url: $("e-url").value, description: $("e-desc").value });
    $("edit").close();
    say("l-msg", `Saved go/${editing}.`);
    markFresh(editing);
    load();
  } catch (err) {
    say("e-msg", err.message, true);
  }
};

$("q").oninput = load;
// "/" anywhere focuses search; Esc clears it and leaves.
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.target.closest("input, textarea, select, dialog")) {
    e.preventDefault();
    $("q").focus();
  }
});
$("q").onkeydown = (e) => {
  if (e.key !== "Escape") return;
  $("q").value = "";
  $("q").blur();
  load();
};
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.localLinks) load();
});

const params = new URLSearchParams(location.search);
if (params.get("new")) {
  $("n-slug").value = params.get("new");
  say("n-msg", `go/${params.get("new")} does not exist yet. Add a destination to create it.`);
  $("n-url").focus();
}
if (params.get("url")) $("n-url").value = params.get("url");
load();
