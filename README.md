# Cairn

Self-hosted go links for your company, built entirely on Cloudflare: type `go/roadmap` in the
address bar and land on the right page. Cairn is two pieces:

- **`server/`** — a Cloudflare Worker where people create, search and share links. Cloudflare
  Access signs people in with your identity provider (Okta, Entra ID, Google, any SAML or OIDC
  provider). Links live in D1, redirects are cached in KV, and usage goes to Workers Logs.
- **`extension/`** — a Chrome extension that makes `go/name` work in the address bar, with no
  DNS or hosts-file changes. It works on its own too: in **local mode** it keeps links in the
  browser, with no server at all.

It is built to cost nothing to run at company scale and to have no cold starts.
The reasoning behind each choice is in [docs/DECISIONS.md](docs/DECISIONS.md).

## How it works

```
 address bar: go/roadmap
        │  extension rewrites the URL (before DNS)
        ▼
 https://go.example.com/roadmap ──► Worker
         Cloudflare Access ─ signed in?  no ─► your IdP ─► back
                                     ├─ memory cache ─► KV ─► D1
                                     └─ 302 to the destination
```

- `go/name/anything` passes `anything` through. Put `{*}` in a destination to choose where it
  goes: `https://tracker.example.com/browse/{*}` makes `go/bug/ABC-12` open that ticket.
- A name nobody has claimed opens the "new link" form with the name filled in.
- Whoever creates a link owns it. Owners and admins can edit, delete or hand it over; everyone
  signed in can use and search all links.

## Deploy the server

### One click

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/geoffnin/cairn/tree/main/server)

The button copies the `server/` folder into a new GitHub repository on your account, creates
the Worker, its D1 database and KV namespace in your Cloudflare account, sets up the tables,
and connects the repository so every push redeploys. Then:

1. **Turn on Cloudflare Access for the Worker.** In the Cloudflare dashboard, open the Worker's
   settings and enable Access. Choose who may sign in: for example, emails ending in
   `@example.com`, or a group from your identity provider. Until this is on, Cairn refuses
   every request.
2. **Connect your identity provider** (optional) in Zero Trust → Settings → Authentication,
   for example Okta, Entra ID or Google, via SAML or OIDC. Without one, Access signs people in
   with a one-time code sent by email.
3. **Set the session duration** on the Access application to decide how often people sign in
   again; the maximum is one month.
4. **Use your own hostname** (optional): add a custom domain such as `go.example.com` to the
   Worker. Until then it is reachable at its `workers.dev` address.
5. **Make yourself an admin:** set `ADMIN_EMAILS` (and optionally the other settings below)
   in your copy's `wrangler.jsonc` and push.

Access is part of Cloudflare Zero Trust, which has a free tier for small teams (check current
pricing for your headcount). Your copy of the repository does not follow this one; pull new
versions with git when you want them.

### From the command line

You need a Cloudflare account and Node 22+.

```sh
cd server
npm ci
npx wrangler login
npm run deploy
```

The first deploy creates the D1 database and KV namespace (named after the Worker) and applies
the migrations; later deploys apply new migrations first, then deploy. `npm run deploy -- --dry-run`
checks the build without touching your account. To use a hostname of your
own, uncomment `routes` in `wrangler.jsonc`. Then turn on Access as in steps 1 to 3 above.

**Using a separate Access application instead.** If the hostname is already protected by a
self-hosted Access application (rather than Access on the Worker), copy that application's AUD
tag and your team domain into `wrangler.jsonc` as `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN`. Cairn
then verifies the token Access attaches to each request itself.

Either way, Cairn refuses any request that Access has not signed in, so the `workers.dev`
address is never open.

### Settings

| Variable | Purpose |
|---|---|
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | Only with a separate Access application: your team domain and the application's AUD tag |
| `AUTH_MODE` | `access` (default), or `dev` for `wrangler dev` on localhost |
| `ADMIN_EMAILS` | Comma-separated emails who can edit any link |
| `ADMIN_GROUPS` | Comma-separated group names from your identity provider. With Access on the Worker these come from Access directly; with a separate Access application, only if your identity provider passes a `groups` claim |
| `ALLOWED_EMAIL_DOMAINS` | Only these email domains may use Cairn, e.g. `example.com,example.co.uk`, on top of the Access policy. Checked on every request |
| `METRICS_DASHBOARD_URL` | Where each link's Metrics link goes (see below) |
| `REDIRECT_CACHE_SECONDS` | How long each Worker instance reuses a redirect, 0-3600, default 30. `0` turns this cache off |

No secrets are needed: Cairn holds no passwords, client secrets or signing keys.

## Link metrics (optional)

Every visit to a link writes one structured log line, the event `cairn.link.click`:

```json
{
  "event.name": "cairn.link.click",
  "link.slug": "roadmap",
  "link.found": true,
  "link.target_host": "docs.example.com",
  "link.passthrough": false,
  "client.kind": "extension",
  "client.country": "GB"
}
```

`link.found: false` means someone tried a name that does not exist yet, which tells you what
links people expect. The event never contains the full destination URL or who clicked.

Changes to links write their own events: `cairn.link.create`, `cairn.link.update` and
`cairn.link.delete`. Each records the link, its owner, the destination's host, **who made the
change** (`user.email`) and whether an admin changed someone else's link
(`user.admin_override`). Updates also say which fields changed and what the previous host or
owner was:

```json
{
  "event.name": "cairn.link.update",
  "link.slug": "roadmap",
  "link.owner": "bob@example.com",
  "link.target_host": "new-docs.example.com",
  "link.has_description": true,
  "link.has_placeholder": false,
  "link.changed": "owner,url",
  "link.previous_target_host": "docs.example.com",
  "link.previous_owner": "alice@example.com",
  "user.email": "alice@example.com",
  "user.admin_override": false,
  "client.kind": "browser"
}
```

Saves that change nothing, and changes that are refused, are not logged.

Cloudflare collects these lines for you. They are searchable in the dashboard under Workers
Logs straight away. To get them into your own platform:

1. In the Cloudflare dashboard, add an OpenTelemetry **logs** destination for your platform
   (its OTLP logs endpoint and auth header) and give it a name.
2. Put that name in `observability.logs.destinations` in `wrangler.jsonc` and redeploy.
3. In your platform, count events where `event.name = cairn.link.click`, grouped by `link.slug`.
4. Set `METRICS_DASHBOARD_URL` so each link in the Cairn UI gets a **Metrics ↗** link to your
   dashboard. `{slug}` is replaced with the link name, for example
   `https://your-stack.grafana.net/d/abc/cairn?var-slug={slug}`.

Cairn itself sends nothing and holds no credentials for this; Cloudflare does the shipping.
Exporting to a third party may need the Workers Paid plan, so check Cloudflare's current
pricing. Keep `head_sampling_rate` at `1`, or counts will be sampled. The reasoning is in
[decision D17](docs/DECISIONS.md).

## Install the extension

**Try it:** open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick
the `extension/` folder. The settings page opens with **local mode** selected, so `go/` links
work straight away, stored in this browser.

**Local mode** keeps links in this Chrome profile only (`chrome.storage.local`): no server, no
sign-in, nothing shared and nothing synced to other devices. Links behave exactly as on a server,
including `{*}` pass-through. An unknown name opens the extension's own "new link" page, and
**Manage links** in settings lists, searches, edits and deletes them. There is no import or
export yet, so links made in local mode stay in local mode.

**Shared mode** uses your company's Cairn server instead, so everyone sees the same links:

1. In settings, under **Shared**, enter the server URL and choose **Use this server**.
2. Allow the permission Chrome asks for, so the extension can reach your server.
3. If you are not signed in yet, a tab opens on the server and Cloudflare Access asks you to sign
   in with your company account. After that, links, the toolbar popup and address-bar search
   all use that sign-in until the Access session expires.

There is one server at a time. Switch between this browser and shared in settings or in the
toolbar popup; the other side's links are kept, just not used.

**Roll it out:** zip the `extension/` folder and publish it (unlisted or private) on the Chrome
Web Store, then force-install it by policy. Set the server URL for everyone with a managed
storage policy (the extension's `serverUrl` setting); people then only need to sign in, and
local mode is not offered. Where that setting goes depends on how you manage Chrome:

- **Google Admin console:** under the force-installed extension's settings, paste the policy
  JSON: `{ "serverUrl": { "Value": "https://go.example.com" } }`
- **Windows (registry):** a string value `serverUrl` under
  `HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\<extension-id>\policy`
- **Linux (JSON policy file** in `/etc/opt/chrome/policies/managed/`):

  ```json
  {
    "3rdparty": {
      "extensions": {
        "<extension-id>": { "serverUrl": "https://go.example.com" }
      }
    }
  }
  ```

Check `chrome://policy` on a managed machine afterwards: `serverUrl` should be listed under the
extension. These formats follow Chrome's administrator documentation but have not been tried on
a managed fleet.

### Using it

- Type **`go/name`** in the address bar.
- Or type **`go`**, press space, and start typing to search link names.
- Click the toolbar button to create a link for the page you are on. It saves wherever links
  currently come from (this browser or your server); once a server is set, the popup lets you
  switch.

If Chrome runs a web search the first time you type `go/name`, type `go/name/` (trailing slash)
once, or use the `go` + space form; Chrome then remembers it as an address.

## Develop

```sh
cd server
cp .dev.vars.example .dev.vars   # AUTH_MODE=dev: signed in as dev@example.com on localhost
npm run migrate:local
npm run dev                      # http://localhost:8787
npm test                         # runs in the Workers runtime with local D1 and KV
npm run typecheck

cd ../extension && npm test      # the extension's link rules, shared with the server's
```

Cloudflare Access does not run locally, so `dev` mode signs you in as a fixed user, and only on
localhost. Point the extension at `http://localhost:8787` to test the two together.

### API

All routes need a Cloudflare Access session. Writes need the header `X-Cairn-Request: 1`.

| Method and path | |
|---|---|
| `GET /_/api/me` | Current user |
| `GET /_/api/links?q=&owner=me&limit=` | Search and list |
| `POST /_/api/links` | Create: `{ slug, url, description? }` |
| `GET /_/api/links/:slug` | Read. Includes `rev`, which changes on every edit |
| `PUT /_/api/links/:slug` | Update any of `{ url, description, owner }`. Send the `rev` you last saw to get `409` instead of overwriting someone else's change |
| `DELETE /_/api/links/:slug?rev=` | Delete; `rev` optional, as for `PUT` |

## Good to know

- **Edits take up to about 90 seconds to reach everyone.** Each Worker instance reuses a redirect
  it has looked up for `REDIRECT_CACHE_SECONDS` (default 30), and KV takes up to about a minute
  to update in every Cloudflare location. A newly created link shows up within about 5 seconds
  for someone who tried the name just before. Lower the setting (or set `0`) if edits must land
  faster; the cost is more KV reads, which are cheap.
- **If the redirect cache cannot be updated, edits are refused** with "try again later"
  (for example once KV's 1,000 free writes a day are used up), rather than saved and served
  stale. Each edit or delete uses up to two KV writes.
- **Offboarding is done in Zero Trust.** Removing someone from your identity provider stops new
  sign-ins. To end sessions that are already open, revoke the person's sessions from their
  entry in the Zero Trust users list. Otherwise they last until the Access session duration runs out.
- **Signing out** of Cairn signs you out of Cloudflare Access for that application, which also
  signs the extension out.
- **Upgrading from an earlier version?** Cairn's own sign-in (OIDC, session cookies, extension
  tokens) has been removed. Set up Access before deploying, and remove the old
  `SESSION_SECRET` and `OIDC_CLIENT_SECRET` secrets with `wrangler secret delete`. Migration
  `0004` drops the extension token table.
- **Cairn does not count clicks itself.** Usage lives only in your metrics platform, reached
  through the Metrics link. Without a log destination, the events are still searchable in
  Workers Logs in the Cloudflare dashboard. Redirects write nothing to D1.
- **Upgrading from an earlier version?** Migration `0003` deletes the old `clicks` and
  `last_clicked_at` columns and the counts in them. Export them first if you want them.
- **Free-tier ceilings.** KV allows 1,000 writes a day free, which bounds link edits plus
  first-time cache fills. The $5/month Workers plan lifts that well past company scale.
- **Check how your platform receives the event's fields.** Cloudflare forwards each event as an
  OpenTelemetry log record. Whether the fields arrive as separate attributes or as a JSON body
  your platform must parse was not confirmed against a live destination. Send one click and
  look at the record before building a dashboard.
- **Not yet proven against live services.** The tests sign real tokens with a stand-in Access
  key and simulate Access on the Worker, and the extension was tested against a local imitation
  of Access. Nothing has been deployed to a real Cloudflare account behind real Access,
  installed with the Deploy to Cloudflare button, or forwarded logs to a real platform.

## License

MIT
