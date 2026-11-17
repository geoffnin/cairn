# Decision log

Newest decisions go at the bottom. Each entry records what was chosen, what it was chosen over,
and what would make us revisit it. Pricing and quota figures are from the providers' public
pages at the time of writing; check them before relying on them.

---

## D1. Run on Cloudflare Workers, not Lambda + DynamoDB

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** The server is a single Cloudflare Worker.

**Why.** A go-link server does one latency-sensitive thing: turn a short name into a 302.
Every redirect is a person waiting, so cold starts matter more than for most internal tools.

| | Workers | Lambda + DynamoDB |
|---|---|---|
| Cold start | V8 isolates start in a few milliseconds and are warmed during the TLS handshake. There is nothing to configure. | 100 ms to 1 s+ for Node. Removing it means provisioned concurrency: a fixed monthly charge per warm instance, per region, whether or not anyone is clicking. |
| Idle cost | Free tier covers 100k requests/day. | Near zero without provisioned concurrency; a few dollars a month per warm instance with it. |
| Moving parts to self-host | Worker, D1 database, KV namespace. One `wrangler deploy`. | Lambda, API Gateway or Function URL, CloudFront and ACM for a custom domain, DynamoDB, IAM roles, and IaC to hold it together. |
| Where it runs | Every Cloudflare location, close to each user. | One region unless you pay to replicate. |

For a typical company (hundreds of people, thousands of redirects a day) the Workers setup costs
nothing and has no cold start to manage, which answers both the "economic" and "minimise or
eliminate cold start" requirements at once.

**If you must be on AWS.** Port `src/links.ts` to DynamoDB (one table, `slug` as partition key,
on-demand billing) and wrap `src/index.ts` in a Lambda handler. To minimise cold starts:
arm64; a small bundle with no SDK beyond the DynamoDB client; a Function URL behind CloudFront
rather than API Gateway; and either one unit of provisioned concurrency (eliminates cold starts
for that instance, at a fixed monthly cost) or a compiled runtime (Go or Rust on
`provided.al2023`, or LLRT) to get cold starts down to tens of milliseconds without paying for
warmth. The in-memory cache in `links.ts` carries over unchanged; KV has no free equivalent, so
the cache would be memory plus DynamoDB.

**Revisit if.** The organisation cannot use Cloudflare, or needs data residency that D1's
location options cannot satisfy.

---

## D2. Store links in D1 (SQLite), not KV alone or Durable Objects

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** D1 is the source of truth. One table, `links`, keyed by slug.

**Why.** The redirect path is a key lookup, which any store handles. The management side is
not: search across name, URL and description, "only my links", atomic "create if not taken",
click counters. Those are one-line SQL statements and awkward in a key-value store. KV on its
own is also eventually consistent, so two people could both "successfully" claim the same name.
Durable Objects would work but add a programming model this problem does not need.

D1's free tier (5 million rows read and 100k rows written per day, 5 GB) is far beyond what a
link directory uses.

**Trade-off.** A D1 database lives in one region, so a query from the other side of the world
pays a round trip. D3 exists to take that off the redirect path.

---

## D3. Cache redirects in two layers in front of D1

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** `lookupTarget` reads through three levels:

1. **Per-isolate memory**, 30-second TTL, capped at 2,000 entries. Free and instant.
2. **Workers KV**, written through on every create, update and delete, 7-day TTL as a backstop.
   Served from the nearest Cloudflare location.
3. **D1**, on a miss in both.

**Why.** KV reads are edge-local, so a warm redirect never leaves the user's region. Writing
through on mutation (rather than waiting for expiry) means an edit is visible quickly.

**Details that are deliberate.**

- *Unknown names are cached in memory only.* KV's free tier allows 1,000 writes a day; spending
  them on typos would be wasteful, and a negative entry in KV could hide a link someone just
  created.
- *Cache failures never fail a request.* If KV is down or over quota the Worker logs and falls
  back to D1.
- *Staleness is bounded, not zero.* After an edit, another isolate may serve the old target for
  up to 30 seconds (memory), and another location for up to about 60 seconds (KV propagation).
  That is acceptable for links that change rarely, and is documented in the README.

**Rejected.** The HTTP Cache API: redirects require authentication (D6), so responses are not
cacheable as HTTP objects; caching the *data* is the right level.

---

## D4. Authenticate with OpenID Connect; use Cloudflare Access for SAML

**Date:** 2026-11-17 · **Status:** accepted

**Context.** The brief said to assume Okta but prefer something provider-agnostic, and
mentioned SAML.

**Decision.** Two production modes, selected by `AUTH_MODE`:

- **`oidc` (default).** A generic OpenID Connect authorization-code flow with PKCE, configured
  entirely from the issuer URL via discovery. Works unchanged with Okta, Microsoft Entra ID,
  Google Workspace, Auth0, Keycloak, JumpCloud, OneLogin and anything else that speaks OIDC.
- **`access`.** Put Cloudflare Access in front of the hostname and let it do the login. Access
  supports SAML and OIDC identity providers; the Worker only verifies the signed JWT Access
  attaches to each request. This is the path for a SAML-only IdP.

**Why not implement SAML in the Worker.** SAML means parsing and canonicalising XML and
verifying XML signatures. That is a large dependency in a runtime without a native XML stack,
and it is a class of code with a long history of authentication bypasses (signature wrapping,
comment injection). OIDC needs only JSON, HTTPS and one RS256 signature check, all of which
WebCrypto provides, so the whole implementation is small enough to read and test in full. Every
mainstream IdP that offers SAML also offers OIDC, and for the rare one that does not, Access
bridges it without us owning SAML code.

**Also decided.**

- Only RS256 ID tokens are accepted. It is the default for every IdP listed above. Add ES256 in
  `jwt.ts` if an IdP needs it.
- `email` is the user identifier, falling back to `preferred_username` because Entra ID often
  omits `email`. A token with `email_verified: false` is refused.
- Admins come from `ADMIN_EMAILS` or from membership of a group in `ADMIN_GROUPS` (read from the
  `groups` claim). Either works alone.
- `AUTH_MODE=dev` exists for local development and refuses to run on any hostname other than
  localhost.

---

## D5. Stateless signed session cookie, 24 hours

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** After login the Worker sets an HMAC-SHA256-signed cookie (`HttpOnly`,
`SameSite=Lax`, `Secure` on HTTPS) holding email, name and the group-admin flag. No session
table.

**Why.** No storage read per request, nothing to clean up, and it keeps the redirect path to
"verify a MAC, read the cache". The cookie holds nothing secret, so signing is sufficient.

**Trade-off.** A session cannot be revoked individually before it expires. That is why the
default lifetime is 24 hours rather than weeks: someone removed from the IdP loses access within
a day. Re-authentication is invisible while the IdP session is alive (one extra redirect).
Rotating `SESSION_SECRET` signs everyone out at once. `ADMIN_EMAILS` is checked on every
request, so removing an admin there is immediate.

**Fail closed.** The Worker refuses to run in `oidc` mode with a `SESSION_SECRET` shorter than
32 characters.

---

## D6. Require sign-in for redirects, not just for editing

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** Every route except the login endpoints and `/_/healthz` requires an authenticated
user, including `go/name` redirects.

**Why.** Link names and targets leak internal information (project code names, hostnames of
internal tools, document IDs). An unauthenticated redirector would let anyone on the internet
enumerate them. The cost is one silent SSO bounce per day per browser.

**Revisit if.** There is demand for public links; that should be a per-link flag, not a global
switch.

---

## D7. The extension only rewrites `go/...`; the server owns identity

**Date:** 2026-11-17 · **Status:** partly superseded by D13 (prefix), D14 (several servers) and
D15 (the extension now holds a sign-in token). The redirect mechanism and permission model
below still stand.

**Decision.** The Chrome extension (Manifest V3) does three things:

1. Installs one `declarativeNetRequest` rule redirecting `http(s)://go/<x>` to
   `<server>/<x>`. This happens before DNS, so no `go` hostname, hosts-file entry or search
   domain is needed.
2. Registers `go` as an address-bar keyword, with suggestions from the server.
3. Offers a toolbar popup to create a link for the current page.

It stores no credentials. Redirects are ordinary navigations, so the server's own session
cookie applies. The popup and suggestions call the API with the browser's existing cookie.

**Why.** Keeping tokens out of the extension removes a whole category of risk and code (token
storage, refresh, logout sync). `declarativeNetRequest` is evaluated by the browser itself, so
redirects work even when the extension's service worker is asleep, and the extension never sees
browsing traffic.

**Permissions, kept minimal.**

- `declarativeNetRequestWithHostAccess` plus host access to `*://go/*` only, rather than the
  broader `declarativeNetRequest` permission.
- Access to the server's origin is an *optional* permission requested when the user saves the
  server URL. If it is declined, redirects still work and the popup hands off to the website's
  create form instead of calling the API.
- `activeTab` to read the current tab's URL when the popup is opened.

**Enterprise rollout.** The server URL can be set by policy through `storage.managed`
(`managed_schema.json`); a managed value overrides and locks the user's setting.

**Fixed for now.** The keyword is `go`. Making it configurable means dynamic host permissions
and a non-configurable omnibox keyword that would no longer match; not worth it yet.

**Found during testing.** `chrome.storage.managed.get()` can fail to settle on a profile with no
policy. `config.js` bounds it to one second and falls back to the user's setting, and the popup
attaches its handlers before awaiting configuration so an early click is not lost.

---

## D8. CSRF defence: required custom header plus Origin check

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** Every non-GET API request must carry `X-Cairn-Request: 1`, and if an `Origin`
header is present it must be the server's own origin or a `chrome-extension://` origin. The
server never answers CORS preflights.

**Why.** Sessions are cookies, so writes need CSRF protection. A custom header cannot be sent
cross-origin without a preflight, and with no CORS headers the preflight fails, so a hostile
page cannot write. `SameSite=Lax` is a second layer. This needs no token state, in keeping with
D5. Extensions are allowed because one can only reach the API if the user (or policy) granted
it access to the server's origin.

---

## D9. Link semantics

**Date:** 2026-11-17 · **Status:** accepted

- **Names** are case-insensitive, 1 to 64 characters from `a-z 0-9 - _ .`, and must start with a
  letter or digit. Because `_` cannot start a name, everything under `/_/` (UI, API, auth) can
  never collide with a link.
- **Ownership.** First to claim a name owns it. The owner or an admin can edit, delete or
  transfer it; everyone signed in can read and use every link. This matches how go links are
  used in practice: a shared, browsable namespace.
- **Pass-through.** `{*}` in a target is replaced by whatever follows the name
  (`go/bug/ABC-12`); it is URL-encoded when it lands in a query string so it cannot inject extra
  parameters. Without a placeholder the remainder is appended to the target's path. Query
  parameters on the request are appended to the target's.
- **Targets** must be `http` or `https`. This blocks `javascript:` and `data:` URLs.
- **Unknown names** redirect to the create form with the name filled in, turning a dead end into
  the natural next step.
- **Redirects are `302` with `Cache-Control: no-store`** so edits take effect immediately in the
  browser and every use is counted.

---

## D10. Count clicks in D1, off the request path

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** Each redirect increments `clicks` and sets `last_clicked_at` inside
`ctx.waitUntil`, after the response is sent.

**Why.** Usage counts tell people which links matter and which are dead. Doing it after the
response keeps it from adding latency, and a failed increment is logged and dropped.

**Limit.** One D1 write per redirect means D1's free tier caps this at about 100k redirects a
day. Beyond that, move counting to Workers Analytics Engine or batch it; the write is isolated
in `recordClick` to make that a small change.

---

## D11. No runtime dependencies, no build step for the UI

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** The Worker has zero runtime dependencies: routing is a short `if` chain, crypto is
WebCrypto, and the management UI is one self-contained HTML page served by the Worker under a
nonce-based Content-Security-Policy. The extension is plain ES modules with no bundler.

**Why.** For a self-hosted tool that handles authentication, less code from other people means
less to audit and less to update. The whole server is about 1,000 lines, a quarter of which is the UI page. The surface is small
enough that a framework would add more than it removes.

**Revisit if.** The UI grows beyond one page.

---

## D12. Testing approach

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** Tests run inside the real Workers runtime (`@cloudflare/vitest-plugin`) against
local D1 and KV, with the identity provider replaced by a fake that signs real RS256 tokens.
They cover the redirect and cache paths, API permissions and validation, CSRF, the full OIDC
flow, forged/expired/wrong-audience tokens, open-redirect attempts, Access mode and dev mode.

The extension was exercised end to end in Chromium against a local server (redirect rule,
unknown-link flow, popup with and without host access).

The second round (D13 to D15) was tested the same way, plus a browser run against a local fake
OIDC provider covering: add a server, sign in once, clear all cookies and still resolve links,
a custom prefix, switching between two servers, sign out and remove.

**Not yet verified.** Chrome's permission prompt itself (the test build pre-granted the hosts,
since headless Chrome cannot click the prompt), a deployment against a live Cloudflare account and a live Okta tenant, and
how Chrome's address bar treats a typed `go/name` on first use (see README, "Using it").

---

## D13. The server decides the prefix

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** `LINK_PREFIX` on the server (default `go`) sets the word typed before the slash.
The server publishes it, with its sign-in method, at the unauthenticated endpoint `/_/config`.
The extension reads it when a server is added and again at browser start, and builds its
redirect rule from it. The web UI and API messages use it too.

**Why on the server.** The prefix is a property of the company's deployment, not of each
person's browser. Setting it once on the server means nobody configures it by hand and a
change rolls out by itself.

**Constraints.** The prefix must be a single DNS label (letters, digits, hyphens, up to 32
characters) because the browser treats it as a hostname. An invalid value makes the server
refuse to start serving rather than guess.

**Consequences.**

- The extension ships with host access to `*://go/*` only. For any other prefix Chrome asks
  the user to allow `*://<prefix>/*` when they add the server. If the prefix later changes, the
  settings page shows a "Grant access" button; redirects for the new prefix do not work until
  it is clicked. A company that knows its prefix can put it in `host_permissions` in its own
  build to avoid the prompt.
- `/_/config` is public and sends `Access-Control-Allow-Origin: *`. It reveals only the prefix
  and sign-in mode, which anyone with the extension already knows.
- The address-bar *keyword* (type `go`, press space, search) is fixed in the extension manifest
  and stays `go` whatever the prefix. Chrome does not let extensions change it at runtime.
  Change `omnibox.keyword` in `manifest.json` for a custom build.

---

## D14. The extension can hold several servers; one is in use at a time

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** The settings page keeps a list of servers. One is active; its prefix is the one
that redirects. The active server can be changed in settings or from the toolbar popup. The
list syncs with the Chrome profile; sign-ins do not.

**Why one at a time.** Two servers may use the same prefix (staging and production both on
`go`), so "all at once" would be ambiguous. A single explicit choice is predictable.

**Policy.** A `serverUrl` set through managed storage still pins the server and hides the list
controls. The user only signs in.

---

## D15. The extension signs in once and holds a revocable token

**Date:** 2026-11-17 · **Status:** accepted · **Changes:** D7 ("stores no credentials") and the
trade-off in D5

**Context.** With only the 24-hour web session (D5), people were bounced through the IdP daily
and the extension had no sign-in of its own. The request was to authenticate once, when the
server is configured.

**Decision.** In `oidc` mode, adding a server starts a one-time sign-in:

1. The extension opens `/_/auth/extension?challenge=<hash of a secret it keeps>`. The person
   signs in through the normal OIDC flow if needed.
2. A consent page names the account. Approving it lands on a page whose URL carries a
   two-minute, signed code.
3. The extension reads the code from that tab and exchanges it, with its secret, for a token.

From then on the extension attaches the token (`Authorization: Bearer`) to its own API calls
and, through a second `declarativeNetRequest` rule, to page loads and API calls on the active
server. So redirects and the website work without the web session cookie.

**Token design.**

- Random, 30 days by default (`EXTENSION_TOKEN_TTL_DAYS`). Stored hashed in D1
  (`extension_tokens`), never in the clear, so a database leak does not leak sign-ins.
- **Revocable**, unlike session cookies: the extension's "Sign out", `DELETE /_/api/tokens`
  (all of your own), and `DELETE /_/api/tokens?email=` for admins. Validations are cached in
  memory for 60 seconds, so revocation takes up to a minute to reach every isolate.
- `ALLOWED_EMAIL_DOMAINS` is re-checked on every request, for tokens and cookies alike.
- Kept in `chrome.storage.local`, which is not synced between devices.

**Why this flow.**

- *Code plus secret (PKCE-style), not a token in the URL.* Anything that can see the tab's
  address gets a code it cannot redeem.
- *A consent click.* Without it, any page or extension could start the flow in the background
  for someone already signed in and collect a token.
- *Watching a tab instead of `chrome.identity.launchWebAuthFlow`.* It needs no extra
  permission, works identically in every Chromium browser, and could be tested end to end.
  It needs host access to the server, which the extension requests anyway.

**Trade-offs, stated plainly.**

- Someone removed from the IdP keeps working links for up to 30 days unless an admin revokes
  their tokens or `ALLOWED_EMAIL_DOMAINS` excludes them. Offboarding should include the revoke
  call. Shorten `EXTENSION_TOKEN_TTL_DAYS` if that gap is too long.
- Admin-by-group is captured at sign-in and lasts as long as the token. `ADMIN_EMAILS` is still
  checked live.
- While the extension is signed in, the website's "Sign out" only clears the cookie; the
  extension keeps the browser signed in until "Sign out" is used in its settings.
- The header is attached to any request for the server, including ones started by other sites.
  The CSRF rules in D8 still apply to those, so this adds no write path.
- Not used in `access` mode: Cloudflare Access owns the session there and would block requests
  before the token is seen.

**Found during testing.** A consent page served with `Referrer-Policy: no-referrer` makes
Chrome send `Origin: null` on its own form post, which the origin check then rejects. The page
uses `same-origin`.

---

## Deferred

Not built, on purpose, until someone needs them:

- Edit history / audit log for links.
- Link expiry, aliases, and per-link visibility.
- Group-owned links.
- Firefox and Safari extensions (Firefox should need only manifest changes).
- SCIM or other deprovisioning hooks (see the D5 and D15 trade-offs).
- A screen for admins to see and revoke extension sign-ins (the API exists).
- Infrastructure-as-code for the Cloudflare resources; three `wrangler` commands do it today.
