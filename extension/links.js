import { createLink, deleteLink, listLinks, updateLink } from "./local.js";

const $ = (id) => document.getElementById(id);
const say = (id, text, isErr = false) => {
  $(id).textContent = text;
  $(id).classList.toggle("err", isErr);
};
const el = (tag, props, ...kids) => {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
};

let editing = null;

function row(l) {
  const edit = el("button", { type: "button", className: "quiet", textContent: "Edit" });
  edit.onclick = () => {
    editing = l.slug;
    $("e-title").textContent = `Edit go/${l.slug}`;
    $("e-url").value = l.url;
    $("e-desc").value = l.description;
    say("e-msg", "");
    $("edit").showModal();
  };
  const del = el("button", { type: "button", className: "quiet danger", textContent: "Delete" });
  del.onclick = async () => {
    if (!confirm(`Delete go/${l.slug}?`)) return;
    await deleteLink(l.slug);
    say("l-msg", `Deleted go/${l.slug}.`);
    load();
  };
  const dest = el("td", { className: "url" }, el("span", { textContent: l.url }));
  if (l.description) dest.append(el("small", { textContent: l.description }));
  return el(
    "tr",
    null,
    el("td", { className: "name" }, el("a", { href: `http://go/${encodeURIComponent(l.slug)}`, textContent: `go/${l.slug}` })),
    dest,
    el("td", { className: "act" }, edit, " ", del),
  );
}

async function load() {
  const q = $("q").value;
  const links = await listLinks(q);
  const empty = q.trim() ? "No links match." : "No links yet. Create the first one above.";
  $("rows").replaceChildren(...(links.length ? links.map(row) : [el("tr", null, el("td", { className: "empty", colSpan: 3, textContent: empty }))]));
}

$("new").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const l = await createLink({ slug: $("n-slug").value, url: $("n-url").value, description: $("n-desc").value });
    say("n-msg", `Created go/${l.slug}.`);
    e.target.reset();
    history.replaceState(null, "", "links.html");
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
    load();
  } catch (err) {
    say("e-msg", err.message, true);
  }
};

$("q").oninput = load;
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
