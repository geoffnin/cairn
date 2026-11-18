# Cairn

Self-hosted go links for your company, built entirely on Cloudflare: type `go/roadmap` in the
address bar and land on the right page. Cairn is two pieces:

- **`server/`** — a Cloudflare Worker where people create, search and share links. Cloudflare
  Access signs people in with your identity provider (Okta, Entra ID, Google, any SAML or OIDC
  provider). Links live in D1, redirects are cached in KV, and usage goes to Workers Logs.
- **`extension/`** — a browser extension for Chrome, Edge and Firefox that makes `go/name`
  work in the address bar, with no DNS or hosts-file changes. It works on its own too: in
  **local mode** it keeps links in the browser, with no server at all.

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

The button copies the `server/` folder into a new GitHub repository on your account (with the
web UI already built, in `server/public/_/`), creates
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
change** and whether an admin changed someone else's link (`user.admin_override`). Updates also
say which fields changed and what the previous host or owner was:

```json
{
  "event.name": "cairn.link.update",
  "link.slug": "roadmap",
  "link.owner_id": "5f0c9a7e3b2d41e8a6c1d9f04b7e2a13",
  "link.target_host": "new-docs.example.com",
  "link.has_description": true,
  "link.has_placeholder": false,
  "link.changed": "owner,url",
  "link.previous_target_host": "docs.example.com",
  "link.previous_owner_id": "c41d8e2a9b7f4c06a3e5d1b28f6a0c77",
  "user.id": "c41d8e2a9b7f4c06a3e5d1b28f6a0c77",
  "user.admin_override": false,
  "client.kind": "browser"
}
```

Saves that change nothing, and changes that are refused, are not logged.

**No email addresses are logged.** People appear as random IDs (`user.id`, `link.owner_id`).
The only place an ID is linked to an email is Cairn's own `users` table in D1, which the web
UI uses to show owners. To find out who an ID is, query that table:

```sh
npx wrangler d1 execute DB --remote --command "SELECT email FROM users WHERE id = '<id>'"
```

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

## Tracing (optional)

Traces are on, sampled at 10% of requests. Cloudflare records the request and every KV, D1 and
outgoing call by itself; Cairn adds three spans:

| Span | Attributes |
|---|---|
| `cairn.link.lookup` | `link.slug`, `cache.layer` (`memory`, `kv` or `d1`), `link.found` |
| `cairn.auth` | `auth.method` (`worker_access`, `access_jwt` or `dev`), `auth.identity_cached` |
| `cairn.api` | `http.method`, `cairn.api.route` (e.g. `/links/:slug`), `http.status_code` |

Failures are recorded as exceptions on the span, with any email address in the message
replaced by `[email]`. No span carries an email address. A requested name that could never be
a link (say `go/alice@example.com`) is recorded as `(invalid)`, in traces and in the
`cairn.link.click` event alike, and API paths Cairn doesn't serve are labelled `unknown`.

Traces are visible in the Cloudflare dashboard straight away. To send them to your own platform
over OpenTelemetry, create a traces destination in the dashboard and add its name to
`observability.traces.destinations` in `wrangler.jsonc`, as for logs. Change
`head_sampling_rate` to trace more or fewer requests; it does not affect logs, which stay at
100% so click counts are exact. Exporting to a third party may need the Workers Paid plan.

## Install the extension

**Try it:** download the package for your browser from the latest
[GitHub release](https://github.com/geoffnin/cairn/releases), or build it yourself
(`npm ci && npm run build` at the repository root), then load it:

- **Chrome:** open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and
  pick `extension/dist/chrome/` (or the unzipped `…-chrome-edge.zip`).
- **Edge:** the same, from `edge://extensions`, with the same folder.
- **Firefox** (140 or later): open `about:debugging#/runtime/this-firefox`, choose **Load
  Temporary Add-on** and pick `extension/dist/firefox/manifest.json` (or the `…-firefox.zip`).
  Temporary add-ons last until Firefox restarts; for a lasting install, publish it (below).

The settings page opens with **local mode** selected, so `go/` links work straight away, stored
in this browser.

**Local mode** keeps links in this browser profile only (the extension's local storage): no server, no
sign-in, nothing shared and nothing synced to other devices. Links behave exactly as on a server,
including `{*}` pass-through. An unknown name opens the extension's own "new link" page, and
**Manage links** in settings lists, searches, edits and deletes them. There is no import or
export yet, so links made in local mode stay in local mode.

**Shared mode** uses your company's Cairn server instead, so everyone sees the same links:

1. In settings, under **Shared**, enter the server URL and choose **Use this server**.
2. Allow the permission the browser asks for, so the extension can reach your server.
3. If you are not signed in yet, a tab opens on the server and Cloudflare Access asks you to sign
   in with your company account. After that, links, the toolbar popup and address-bar search
   all use that sign-in until the Access session expires.

There is one server at a time. Switch between this browser and shared in settings or in the
toolbar popup; the other side's links are kept, just not used.

**Roll it out:** take the packages attached to a GitHub release (see [Release](#release)) and
publish them, unlisted or private: `…-chrome-edge.zip` on the Chrome Web Store and on Edge
Add-ons, `…-firefox.zip` on Firefox Add-ons (it asks for the source code too, because the
extension is bundled: upload the release's source archive). Then force-install it by policy.
Set the server URL for everyone with a managed storage policy (the extension's `serverUrl`
setting); people then only need to sign in, and local mode is not offered. Where that setting
goes depends on how you manage the browser:

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

- **Edge:** as for Chrome, under
  `HKLM\Software\Policies\Microsoft\Edge\3rdparty\extensions\<extension-id>\policy` on Windows, or the `3rdparty` key in Edge's JSON policy file elsewhere.
- **Firefox (`policies.json`):** the extension's ID is `cairn@geoffnin.github.io`.

  ```json
  {
    "policies": {
      "3rdparty": {
        "Extensions": {
          "cairn@geoffnin.github.io": { "serverUrl": "https://go.example.com" }
        }
      }
    }
  }
  ```

Check `chrome://policy` (`edge://policy`, `about:policies`) on a managed machine afterwards: `serverUrl` should be listed under the
extension. These formats follow each browser's administrator documentation but have not been tried on
a managed fleet.

### Using it

- Type **`go/name`** in the address bar.
- Or type **`go`**, press space, and start typing to search link names.
- Click the toolbar button to create a link for the page you are on. It saves wherever links
  currently come from (this browser or your server); once a server is set, the popup lets you
  switch.

If the browser runs a web search the first time you type `go/name`, type `go/name/` (trailing
slash) once, or use the `go` + space form; it then remembers it as an address.

## Develop

Use Node 22 (`.node-version`). The repository is an npm workspace: `ui/` (the design system's Svelte components), `web/` (the
server's web UI) and `extension/`. `server/` is its own package, the Cloudflare Worker.

```sh
npm ci                           # at the root: Svelte, Vite and the test tools
npm run build                    # web UI into server/public/_/, extension into extension/dist/chrome/
                                 # and extension/dist/firefox/
npm run lint -w extension        # Firefox's add-on validator on dist/firefox/
npm run check                    # tokens up to date, svelte-check (types and accessibility)
npm test                         # unit and component tests, every story in Chromium, then the
                                 # extension's link rules (once: npx playwright install chromium)
npm run storybook                # the component library on http://localhost:6006

cd server
npm ci
cp .dev.vars.example .dev.vars   # AUTH_MODE=dev: signed in as dev@example.com on localhost
npm run migrate:local
npm run dev                      # http://localhost:8787; Wrangler builds the web UI first and
                                 # rebuilds it when web/src or ui/src change
npm test                         # builds the web UI, then runs in the Workers runtime
npm run typecheck
```

Cloudflare Access does not run locally, so `dev` mode signs you in as a fixed user, and only on
localhost. Point the extension at `http://localhost:8787` to test the two together.

For live reload on the web UI, run `npm run dev -w web` at the root alongside the server's
`npm run dev`: Vite serves the page on http://localhost:5173/_/ and passes API calls to the
Worker. For the extension, `npm run dev -w extension` rebuilds `extension/dist/chrome/` on every save;
reload the extension in `chrome://extensions` to pick it up. `npm run dev:firefox -w extension`
does the same for `extension/dist/firefox/` (or run `npx web-ext run -s extension/dist/firefox`
from the root, which starts Firefox with it and reloads it for you).

The extension has one source for every browser. `extension/manifest.json` is Chrome's (and
Edge's) manifest; `extension/vite.config.ts` adjusts it for Firefox (an event-page background
script instead of a service worker, the add-on ID, no managed-storage schema). Code calls the
extension APIs through `ext` from `extension/ext.js`, which is `browser` in Firefox and
`chrome` in Chrome and Edge; the few behaviour differences check `__TARGET__`.

### Release

Bump `version` in `extension/manifest.json`, merge, then publish a GitHub release tagged with
that version (`v0.6.0` for `0.6.0`). The Release workflow builds and lints the extension and
attaches `cairn-extension-<version>-chrome-edge.zip` and `cairn-extension-<version>-firefox.zip`
to the release; it fails if the tag and the manifest disagree.

### Frontend

Both UIs are Svelte apps built by Vite into static files: the server's into `server/public/_/`,
which the Worker serves after signing the request in, and the extension's into
`extension/dist/<browser>/`. The manage page (New link card, search, links table, edit dialog) is one
component, `ui/src/components/LinksPage.svelte`, used by both; each app hands it a `LinkSource`
that says where links live (`web/src/api.ts` for the server, `extension/src/localLinks.ts` for
this browser).

```
design/tokens.json          design tokens exported from the Cairn design system
design/build-tokens.mjs     turns them into ui/src/styles/tokens.css
ui/src/styles/global.css    tokens, fonts, element defaults and shared primitives, in cascade layers
ui/src/styles/fonts/        Instrument Sans and IBM Plex Mono (OFL), bundled, never from a CDN
ui/src/components/          one .svelte file per component, its styles scoped inside it, and
                            its stories beside it (Name.stories.svelte)
ui/src/lib/links.ts         the Link and LinkSource types, and helpers both apps use
ui/src/lib/format.ts        counts, dates, owners and shortened URLs as lists show them
ui/src/lib/usage.ts         usage totals and the usage chart's layout
ui/src/lib/passthrough.ts   offering {*} for a page that ends in an ID
ui/src/stories/             demo data and wiring that only the stories use
.storybook/                 Storybook's configuration: theme and density in the toolbar
web/                        the server UI: entry point, App.svelte, the API LinkSource
extension/src/              the popup, settings and manage pages; extension/public/ is copied as is
```

### Storybook

`npm run storybook` opens the component library, built up from small to large:

- **Primitives**: a go/ name, a key, a button, a field.
- **Parts**: a few primitives together, such as a notice that a name is taken, or a step card.
- **Sections**: a whole piece of a page, such as the popup's form or a link's usage chart.
- **Journeys**: the critical user journeys as full screens. 1, the welcome tab after installing;
  2, the toolbar popup in its five states; 3a to 3c, the server's directory, the page for a name
  nobody has made yet, and one link's page with its usage and change history. Some stories are
  wired to links in memory, so a journey can be clicked through.

Each push to `main` that passes CI publishes Storybook to GitHub Pages, at
https://geoffnin.github.io/cairn/.

The toolbar switches theme (light, dark) and density. Every story is also a test: `npm test`
renders each one in Chromium, runs its play function (the interactions it describes, with their
expectations) and checks it for accessibility problems with axe, failing on any. The Accessibility,
Interactions and Tests panels in Storybook show the same results for the story on screen.

Components for the journeys take their data as props and report what people do through
callbacks; the apps have not adopted them yet.

To change a colour, size or font, update `design/tokens.json` and run `npm run tokens`;
`npm run check` fails if `tokens.css` is out of date.

**Commit the server UI's build.** `server/public/_/` is checked in, because the Deploy to
Cloudflare button copies only `server/` and so cannot build the UI itself. After changing
anything under `web/` or `ui/`, run `npm run build` and commit `server/public/_/` with your
change; CI fails if it is out of date. The build is the same on every machine (Svelte's scoped
class names come from the CSS, not the file path), so it only changes when the UI does.

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
