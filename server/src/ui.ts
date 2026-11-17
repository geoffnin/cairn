// The whole management UI: one page, no build step. Its stylesheet, fonts and images are the
// extension's (extension/ui), served from this Worker under /_/ui/ (src/assets.ts).
import { MARK_SVG, STYLESHEET_URL } from "./assets";
import { randomToken } from "./util";

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cairn links</title>
<link rel="stylesheet" href="${STYLESHEET_URL}">
</head>
<body>
<main class="cn-page">
  <header class="cn-header">
    <span class="cn-brand">${MARK_SVG}cairn</span>
    <span class="cn-tagline">Type <span class="cn-go">name</span> in the address bar.</span>
    <span class="cn-who" id="who"></span>
  </header>

  <section class="cn-card">
    <h2>New link</h2>
    <form class="cn-form" id="new">
      <div class="cn-form-grid">
        <label class="cn-field">
          <span class="cn-label">Name</span>
          <span class="cn-gofield"><input id="n-slug" class="cn-input" type="text" required maxlength="64" autocomplete="off" spellcheck="false" placeholder="roadmap"></span>
        </label>
        <label class="cn-field">
          <span class="cn-label">Destination URL</span>
          <input id="n-url" class="cn-input is-mono" type="text" required maxlength="2048" autocomplete="off" spellcheck="false" placeholder="https://docs.example.com/roadmap">
        </label>
        <label class="cn-field is-wide">
          <span class="cn-label">Description (optional)</span>
          <input id="n-desc" class="cn-input" type="text" maxlength="500" autocomplete="off">
        </label>
      </div>
      <p class="cn-hint">Use <code>{*}</code> to pass text through: <code>https://tracker.example.com/browse/{*}</code> makes <span class="cn-go">bug/ABC-12</span> open that ticket.</p>
      <div class="cn-form-foot">
        <button class="cn-btn is-primary" type="submit">Create link</button>
        <p class="cn-status" id="n-msg" role="status"></p>
      </div>
    </form>
  </section>

  <section class="cn-card cn-form">
    <div class="cn-cluster">
      <div class="cn-search">
        <input id="q" class="cn-input" type="search" placeholder="Search names, URLs and descriptions" aria-label="Search links" aria-keyshortcuts="/">
        <span class="cn-kbd" aria-hidden="true">/</span>
      </div>
      <label class="cn-check"><input id="mine" type="checkbox"> Only mine</label>
    </div>
    <div class="cn-table-wrap">
      <table class="cn-table">
        <colgroup><col class="is-name"><col><col class="is-owner"><col class="is-actions"></colgroup>
        <thead><tr><th>Name</th><th>Destination</th><th>Owner</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <p class="cn-status" id="l-msg" role="status"></p>
  </section>
</main>

<dialog id="edit" class="cn-dialog">
  <form id="e-form" method="dialog" class="cn-form">
    <h2 class="cn-section-title" id="e-title"></h2>
    <label class="cn-field"><span class="cn-label">Destination URL</span><input id="e-url" class="cn-input is-mono" type="text" required maxlength="2048" spellcheck="false"></label>
    <label class="cn-field"><span class="cn-label">Description</span><input id="e-desc" class="cn-input" type="text" maxlength="500"></label>
    <label class="cn-field"><span class="cn-label">Owner</span><input id="e-owner" class="cn-input" type="email" required maxlength="254"></label>
    <p class="cn-status is-error" id="e-msg" role="alert"></p>
    <div class="cn-dialog-foot"><button type="button" class="cn-btn is-quiet" id="e-cancel">Cancel</button><button class="cn-btn is-primary" type="submit">Save</button></div>
  </form>
</dialog>

<script nonce="__NONCE__">
const $ = (id) => document.getElementById(id);
const P = 'go/';

async function api(method, path, body) {
  let res;
  try {
    res = await fetch('/_/api' + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-cairn-request': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Cloudflare Access answers an expired session with a redirect to its login page, which
    // fetch cannot follow across origins.
    throw new Error('Your sign-in has expired. Reload the page to sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

function el(tag, props, ...kids) {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
}

// Status lines set go/ names in the go-name style, as everywhere else (extension/ui/status.js).
const GO_NAME = /\\bgo\\/([a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?)/g;
function say(id, text, isErr) {
  const m = $(id), parts = [];
  text = text || '';
  let last = 0;
  for (const g of text.matchAll(GO_NAME)) {
    parts.push(text.slice(last, g.index), el('span', { className: 'cn-go', textContent: g[1] }));
    last = g.index + g[0].length;
  }
  parts.push(text.slice(last));
  m.replaceChildren(...parts.filter((p) => p !== ''));
  m.classList.toggle('is-error', !!isErr);
}

// A destination as people read it: scheme dropped, host in ink, the rest muted.
function destination(url) {
  const m = /^https?:\\/\\/([^/?#]+)(.*)$/i.exec(url);
  const d = el('span', { className: 'cn-dest', title: url });
  if (m) d.append(el('span', { className: 'cn-host', textContent: m[1] }), m[2]);
  else d.textContent = url;
  return d;
}

let editing = null, editingRev = null;
// The link just created or edited settles into the list with the terracotta marker.
let fresh = null, freshTimer;
function markFresh(slug) {
  fresh = slug;
  clearTimeout(freshTimer);
  freshTimer = setTimeout(() => { fresh = null; }, 2000);
}

function row(l) {
  const actions = el('td', { className: 'cn-actions' });
  if (l.metrics_url) {
    actions.append(el('a', { className: 'cn-btn is-small is-quiet', href: l.metrics_url, target: '_blank', rel: 'noopener noreferrer', title: 'Open the metrics dashboard for ' + P + l.slug, textContent: 'Metrics ↗' }));
  }
  if (l.can_edit) {
    const edit = el('button', { className: 'cn-btn is-small is-quiet', type: 'button', textContent: 'Edit' });
    edit.onclick = () => openEdit(l);
    const del = el('button', { className: 'cn-btn is-small is-danger', type: 'button', textContent: 'Delete' });
    del.onclick = async () => {
      if (!confirm('Delete ' + P + l.slug + '? Anyone using it will land on the "create link" page instead.')) return;
      try { await api('DELETE', '/links/' + encodeURIComponent(l.slug) + '?rev=' + encodeURIComponent(l.rev)); say('l-msg', 'Deleted ' + P + l.slug + '.'); load(); }
      catch (e) { say('l-msg', e.message, true); }
    };
    actions.append(edit, del);
  }
  const name = el('td', null, el('a', { className: 'cn-go is-link', href: '/' + encodeURIComponent(l.slug), textContent: l.slug, title: l.description }));
  if (l.description) name.append(el('span', { className: 'cn-desc', textContent: l.description }));
  return el('tr', { className: l.slug === fresh ? 'cn-row is-new' : 'cn-row' },
    name,
    el('td', null, destination(l.url)),
    el('td', { className: 'cn-owner', textContent: l.owner, title: l.owner }),
    actions);
}

function empty(filtered, q) {
  const cell = el('td', { colSpan: 4 });
  if (filtered) {
    cell.append(el('div', { className: 'cn-empty', textContent: q ? 'No links match “' + q + '”.' : 'You have no links yet.' }));
  } else {
    // The mark is the only picture in the product; reuse the header's copy.
    const mark = document.querySelector('.cn-header .cn-mark').cloneNode(true);
    cell.append(el('div', { className: 'cn-empty' }, mark, el('div', { textContent: 'No links yet. Make the first one.' })));
  }
  return el('tr', null, cell);
}

let seq = 0;
async function load() {
  const mine = $('mine').checked, q = $('q').value.trim(), id = ++seq;
  try {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (mine) p.set('owner', 'me');
    const { links } = await api('GET', '/links?' + p);
    if (id !== seq) return;
    $('rows').replaceChildren(...(links.length ? links.map(row) : [empty(!!(q || mine), q)]));
  } catch (e) { say('l-msg', e.message, true); }
}

function openEdit(l) {
  editing = l.slug; editingRev = l.rev;
  say('e-title', 'Edit ' + P + l.slug);
  $('e-url').value = l.url; $('e-desc').value = l.description; $('e-owner').value = l.owner;
  say('e-msg', '');
  $('edit').showModal();
}

$('e-cancel').onclick = () => $('edit').close();
$('e-form').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    await api('PUT', '/links/' + encodeURIComponent(editing), { url: $('e-url').value, description: $('e-desc').value, owner: $('e-owner').value, rev: editingRev });
    $('edit').close(); say('l-msg', 'Saved ' + P + editing + '.'); markFresh(editing); load();
  } catch (e) { say('e-msg', e.message, true); }
};

$('new').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    const l = await api('POST', '/links', { slug: $('n-slug').value, url: $('n-url').value, description: $('n-desc').value });
    say('n-msg', 'Created ' + P + l.slug + '.');
    ev.target.reset(); $('n-slug').focus(); history.replaceState(null, '', '/_/'); markFresh(l.slug); load();
  } catch (e) { say('n-msg', e.message, true); }
};

let timer;
$('q').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 200); };
$('mine').onchange = load;
// "/" anywhere focuses search; Esc clears it and leaves.
document.addEventListener('keydown', (ev) => {
  if (ev.key === '/' && !ev.target.closest('input, textarea, select, dialog')) { ev.preventDefault(); $('q').focus(); }
});
$('q').onkeydown = (ev) => {
  if (ev.key !== 'Escape') return;
  $('q').value = ''; $('q').blur(); load();
};

const params = new URLSearchParams(location.search);
if (params.get('new')) {
  $('n-slug').value = params.get('new');
  say('n-msg', P + params.get('new') + ' does not exist yet. Add a destination to create it.');
  $('n-url').focus();
}
if (params.get('url')) $('n-url').value = params.get('url');

api('GET', '/me').then((me) => {
  $('who').replaceChildren(me.email + (me.isAdmin ? ' (admin) · ' : ' · '), el('a', { href: '/_/auth/logout', textContent: 'Sign out' }));
}).catch(() => {});
load();
</script>
</body>
</html>`;

export function renderUi(): Response {
  const nonce = randomToken(16);
  return new Response(PAGE.replace("__NONCE__", nonce), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  });
}
