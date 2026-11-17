# Cairn

Self-hosted go links for your company: type `go/roadmap` in the address bar and land on the
right page. Cairn is two pieces:

- **`server/`** — a Cloudflare Worker where people sign in with your identity provider and
  create, search and share links. Stores links in D1, caches redirects in KV.
- **`extension/`** — a Chrome extension that makes `go/name` work in the address bar, with no
  DNS or hosts-file changes.

It is built to cost nothing to run at company scale and to have no cold starts.
The reasoning behind each choice is in [docs/DECISIONS.md](docs/DECISIONS.md).

## How it works

```
 address bar: go/roadmap
        │  extension rewrites the URL (before DNS)
        ▼
 https://go.example.com/roadmap ──► Worker
                                     ├─ signed in?  no ─► your IdP (OIDC) ─► back
                                     ├─ memory cache ─► KV ─► D1
                                     └─ 302 to the destination
```

- The prefix is yours to choose: set `LINK_PREFIX` on the server and `acme/roadmap` works
  instead of `go/roadmap`. The extension picks it up from the server.
- `go/name/anything` passes `anything` through. Put `{*}` in a destination to choose where it
  goes: `https://tracker.example.com/browse/{*}` makes `go/bug/ABC-12` open that ticket.
- A name nobody has claimed opens the "new link" form with the name filled in.
- Whoever creates a link owns it. Owners and admins can edit, delete or hand it over; everyone
  signed in can use and search all links.

## Deploy the server

You need a Cloudflare account, a hostname on it (for example `go.example.com`), and Node 22+.

```sh
cd server
npm ci
npx wrangler login
npx wrangler d1 create cairn             # copy database_id into wrangler.jsonc
npx wrangler kv namespace create CACHE   # copy id into wrangler.jsonc
```

In `wrangler.jsonc`, paste the two IDs, uncomment `routes` with your hostname, and fill in the
auth settings for one of the two modes below. Then:

```sh
npm run migrate:remote
npx wrangler secret put SESSION_SECRET   # paste the output of: openssl rand -base64 48
npm run deploy
```

### Sign-in option A: OpenID Connect (default)

Works with any OIDC provider. For **Okta**:

1. Admin console → Applications → Create App Integration → **OIDC – Web Application**.
2. Sign-in redirect URI: `https://go.example.com/_/auth/callback`. Grant type: Authorization
   Code. Assign the people or groups who should have access.
3. Set in `wrangler.jsonc`:
   - `OIDC_ISSUER`: `https://your-org.okta.com` (or your custom authorization server's issuer)
   - `OIDC_CLIENT_ID`: the app's client ID
4. `npx wrangler secret put OIDC_CLIENT_SECRET`

For Entra ID, Google Workspace, Keycloak and others the steps are the same: register a web app
with that redirect URI and set the issuer (the URL that serves
`/.well-known/openid-configuration`), client ID and secret.

### Sign-in option B: Cloudflare Access (use this for SAML)

If your IdP is SAML-only, or you already use Cloudflare Zero Trust, put an Access application in
front of the hostname and let Access handle login. Set `AUTH_MODE` to `access`,
`ACCESS_TEAM_DOMAIN` to `your-team.cloudflareaccess.com` and `ACCESS_AUD` to the application's
AUD tag. No client secret or session secret is needed.

### Settings

| Variable | Purpose |
|---|---|
| `AUTH_MODE` | `oidc` (default), `access`, or `dev` (localhost only) |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`* | OIDC provider |
| `OIDC_SCOPES` | Default `openid email profile`. Add `groups` if you use `ADMIN_GROUPS` with Okta |
| `SESSION_SECRET`* | Signs session cookies; 32+ characters. Rotating it signs everyone out |
| `SESSION_TTL_HOURS` | Session lifetime, default 24 |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | Cloudflare Access mode |
| `ADMIN_EMAILS` | Comma-separated emails who can edit any link |
| `ADMIN_GROUPS` | Comma-separated group names, matched against the token's `groups` claim |
| `ALLOWED_EMAIL_DOMAINS` | Only these email domains may sign in, e.g. `example.com,example.co.uk`. Checked at sign-in and on every request, so tightening it takes effect at once |
| `LINK_PREFIX` | The word before the slash, default `go`. Letters, digits and hyphens |
| `EXTENSION_TOKEN_TTL_DAYS` | How long the extension stays signed in, default 30 |

\* secrets: set with `wrangler secret put`, never in `wrangler.jsonc`.

## Install the extension

**Try it:** open `chrome://extensions`, turn on Developer mode, choose **Load unpacked** and pick
the `extension/` folder. The settings page opens.

1. Enter your server URL and choose **Add and sign in**.
2. Allow the permission Chrome asks for (access to your server, and to your prefix if it is not
   `go`).
3. A tab opens: sign in with your company account if asked, then choose **Connect**. The tab
   closes and you are done. You will not be asked again for 30 days.

You can add more than one server (say, staging and production) and pick which one is in use
from the settings page or the toolbar popup. Only the selected server's prefix redirects.

**Roll it out:** zip the `extension/` folder and publish it (unlisted or private) on the Chrome
Web Store, then force-install it by policy. Set the server URL for everyone with a managed
storage policy; people then only sign in once:

```json
{
  "3rdparty": {
    "extensions": {
      "<extension-id>": { "serverUrl": "https://go.example.com" }
    }
  }
}
```

### Using it

- Type **`go/name`** in the address bar (or your own prefix).
- Or type **`go`**, press space, and start typing to search link names. This keyword is always
  `go`, whatever your prefix; change `omnibox.keyword` in `manifest.json` for a custom build.
- Click the toolbar button to create a link for the page you are on.

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
```

Point the extension at `http://localhost:8787` to test the two together.

### API

All routes need a signed-in session. Writes need the header `X-Cairn-Request: 1`.

| Method and path | |
|---|---|
| `GET /_/api/me` | Current user |
| `GET /_/api/links?q=&owner=me&limit=` | Search and list |
| `POST /_/api/links` | Create: `{ slug, url, description? }` |
| `GET /_/api/links/:slug` | Read |
| `PUT /_/api/links/:slug` | Update any of `{ url, description, owner }` |
| `DELETE /_/api/links/:slug` | Delete |
| `DELETE /_/api/tokens` | Sign your extension out everywhere. Admins: add `?email=` to sign someone else out |
| `GET /_/config` | Public: `{ prefix, auth }`, read by the extension |

## Good to know

- **Edits take up to a minute to reach everyone.** Redirects are cached in memory (30 seconds)
  and in KV (which takes up to about 60 seconds to propagate worldwide).
- **Offboarding needs one extra step.** Extension sign-ins last 30 days. When someone leaves,
  an admin should call `DELETE /_/api/tokens?email=them@example.com`, or they keep working links
  until the sign-in expires. Web sessions last 24 hours and cannot be revoked one by one.
- **The website's "Sign out" does not sign the extension out.** Use Sign out in the extension's
  settings.
- **Free-tier ceilings.** Click counting writes to D1 once per redirect (100k writes/day free),
  and KV allows 1,000 writes/day free, which bounds link edits plus first-time cache fills. The
  $5/month Workers plan lifts both well past company scale.
- **Not yet proven against live services.** The test suite uses a fake identity provider and
  local D1/KV. It has not yet been deployed to a real Cloudflare account or signed in through a
  real Okta tenant.

## License

MIT
