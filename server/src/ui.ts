// The whole management UI: one self-contained page, no build step, no external assets.
import { randomToken } from "./util";

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cairn links</title>
<style>
  :root {
    --bg: #f7f6f3; --surface: #fff; --text: #1d1c1a; --muted: #6b6860; --line: #e2dfd8;
    --accent: #2f6f5e; --accent-text: #fff; --danger: #a8362a; --focus: #2f6f5e55;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #171715; --surface: #21201d; --text: #ecebe6; --muted: #a09c92; --line: #37352f;
            --accent: #6fbfa8; --accent-text: #10241e; --danger: #f0897c; --focus: #6fbfa855; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }
  header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  h1 { font-size: 22px; margin: 0; letter-spacing: -0.01em; }
  h2 { font-size: 15px; margin: 0 0 12px; }
  #who { margin-left: auto; color: var(--muted); font-size: 13px; }
  #who a { color: inherit; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  form.new { display: grid; grid-template-columns: minmax(140px, 1fr) 2fr; gap: 10px; }
  form.new .wide { grid-column: 1 / -1; }
  label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  input[type=text], input[type=url], input[type=search], input[type=email] {
    width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 6px;
    background: var(--bg); color: var(--text); font: inherit;
  }
  input:focus-visible, button:focus-visible { outline: 3px solid var(--focus); outline-offset: 1px; }
  .slug { display: flex; align-items: center; }
  .slug span { color: var(--muted); padding-right: 4px; font-family: ui-monospace, monospace; }
  button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--line);
           background: var(--surface); color: var(--text); cursor: pointer; }
  button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-text); font-weight: 600; }
  button.link { border: 0; background: none; padding: 2px 4px; color: var(--accent); }
  button.link.danger { color: var(--danger); }
  .hint { font-size: 12px; color: var(--muted); margin: 0; }
  .msg { min-height: 20px; font-size: 13px; margin: 8px 0 0; }
  .msg.err { color: var(--danger); }
  .tools { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  .tools input[type=search] { flex: 1; min-width: 180px; }
  .tools label { margin: 0; font-size: 13px; display: flex; gap: 6px; align-items: center; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 500; padding: 6px 8px; border-bottom: 1px solid var(--line); }
  td { padding: 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:last-child td { border-bottom: 0; }
  td.name { font-family: ui-monospace, monospace; white-space: nowrap; }
  td.name a { color: var(--accent); text-decoration: none; font-weight: 600; }
  td.url { max-width: 340px; overflow-wrap: anywhere; }
  td.url small { display: block; color: var(--muted); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num a { color: var(--accent); text-decoration: none; }
  td.num a:hover { text-decoration: underline; }
  td.act { white-space: nowrap; text-align: right; }
  .empty { color: var(--muted); padding: 24px 8px; text-align: center; }
  dialog { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--text);
           padding: 20px; width: min(520px, calc(100vw - 32px)); }
  dialog::backdrop { background: #0006; }
  dialog form { display: grid; gap: 10px; }
  dialog .row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
  @media (max-width: 560px) { form.new { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>Cairn</h1>
    <span class="hint">Short links for your team. Type <b>__PREFIX__/name</b> in the address bar.</span>
    <span id="who"></span>
  </header>

  <section class="card">
    <h2>New link</h2>
    <form class="new" id="new">
      <div>
        <label for="n-slug">Name</label>
        <div class="slug"><span>__PREFIX__/</span><input id="n-slug" type="text" required maxlength="64" autocomplete="off" spellcheck="false" placeholder="roadmap"></div>
      </div>
      <div>
        <label for="n-url">Destination URL</label>
        <input id="n-url" type="text" required maxlength="2048" autocomplete="off" spellcheck="false" placeholder="https://docs.example.com/roadmap">
      </div>
      <div class="wide">
        <label for="n-desc">Description (optional)</label>
        <input id="n-desc" type="text" maxlength="500" autocomplete="off">
      </div>
      <p class="hint wide">Use <code>{*}</code> to pass text through: <code>https://tracker.example.com/browse/{*}</code> makes <b>__PREFIX__/bug/ABC-12</b> open that ticket.</p>
      <div class="wide"><button class="primary" type="submit">Create link</button></div>
    </form>
    <p class="msg" id="n-msg" role="status"></p>
  </section>

  <section class="card">
    <div class="tools">
      <input id="q" type="search" placeholder="Search names, URLs and descriptions" aria-label="Search links">
      <label><input id="mine" type="checkbox"> Only mine</label>
    </div>
    <div class="scroll">
      <table>
        <thead><tr><th>Name</th><th>Destination</th><th>Owner</th><th style="text-align:right">Uses</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <p class="msg" id="l-msg" role="status"></p>
  </section>
</main>

<dialog id="edit">
  <form id="e-form" method="dialog">
    <h2 id="e-title"></h2>
    <div><label for="e-url">Destination URL</label><input id="e-url" type="text" required maxlength="2048" spellcheck="false"></div>
    <div><label for="e-desc">Description</label><input id="e-desc" type="text" maxlength="500"></div>
    <div><label for="e-owner">Owner</label><input id="e-owner" type="email" required maxlength="254"></div>
    <p class="msg err" id="e-msg" role="alert"></p>
    <div class="row"><button type="button" id="e-cancel">Cancel</button><button class="primary" type="submit">Save</button></div>
  </form>
</dialog>

<script nonce="__NONCE__">
const $ = (id) => document.getElementById(id);
const P = '__PREFIX__/';

async function api(method, path, body) {
  const res = await fetch('/_/api' + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-cairn-request': '1' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { location.href = '/_/auth/login?rd=' + encodeURIComponent(location.pathname + location.search); throw new Error('Signing in…'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

function el(tag, props, ...kids) {
  const e = Object.assign(document.createElement(tag), props || {});
  e.append(...kids);
  return e;
}

function say(id, text, isErr) {
  const m = $(id);
  m.textContent = text || '';
  m.classList.toggle('err', !!isErr);
}

let editing = null;

function row(l) {
  const actions = el('td', { className: 'act' });
  if (l.can_edit) {
    const edit = el('button', { className: 'link', type: 'button', textContent: 'Edit' });
    edit.onclick = () => openEdit(l);
    const del = el('button', { className: 'link danger', type: 'button', textContent: 'Delete' });
    del.onclick = async () => {
      if (!confirm('Delete ' + P + l.slug + '? Anyone using it will land on the "create link" page instead.')) return;
      try { await api('DELETE', '/links/' + encodeURIComponent(l.slug)); say('l-msg', 'Deleted ' + P + l.slug + '.'); load(); }
      catch (e) { say('l-msg', e.message, true); }
    };
    actions.append(edit, del);
  }
  const dest = el('td', { className: 'url' }, el('span', { textContent: l.url }));
  if (l.description) dest.append(el('small', { textContent: l.description }));
  return el('tr', null,
    el('td', { className: 'name' }, el('a', { href: '/' + encodeURIComponent(l.slug), textContent: P + l.slug })),
    dest,
    el('td', { textContent: l.owner }),
    el('td', { className: 'num' }, l.metrics_url
      ? el('a', { href: l.metrics_url, target: '_blank', rel: 'noopener noreferrer', title: 'Open the metrics dashboard for ' + P + l.slug, textContent: l.clicks + ' ↗' })
      : String(l.clicks)),
    actions);
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
    const empty = q || mine ? 'No links match.' : 'No links yet. Create the first one above.';
    $('rows').replaceChildren(...(links.length ? links.map(row) : [el('tr', null, el('td', { className: 'empty', colSpan: 5, textContent: empty }))]));
  } catch (e) { say('l-msg', e.message, true); }
}

function openEdit(l) {
  editing = l.slug;
  $('e-title').textContent = 'Edit ' + P + l.slug;
  $('e-url').value = l.url; $('e-desc').value = l.description; $('e-owner').value = l.owner;
  say('e-msg', '');
  $('edit').showModal();
}

$('e-cancel').onclick = () => $('edit').close();
$('e-form').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    await api('PUT', '/links/' + encodeURIComponent(editing), { url: $('e-url').value, description: $('e-desc').value, owner: $('e-owner').value });
    $('edit').close(); say('l-msg', 'Saved ' + P + editing + '.'); load();
  } catch (e) { say('e-msg', e.message, true); }
};

$('new').onsubmit = async (ev) => {
  ev.preventDefault();
  try {
    const l = await api('POST', '/links', { slug: $('n-slug').value, url: $('n-url').value, description: $('n-desc').value });
    say('n-msg', 'Created ' + P + l.slug + '.');
    ev.target.reset(); history.replaceState(null, '', '/_/'); load();
  } catch (e) { say('n-msg', e.message, true); }
};

let timer;
$('q').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 200); };
$('mine').onchange = load;

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

export function renderUi(prefix: string): Response {
  const nonce = randomToken(16);
  return new Response(PAGE.replace("__NONCE__", nonce).replaceAll("__PREFIX__", prefix), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  });
}
