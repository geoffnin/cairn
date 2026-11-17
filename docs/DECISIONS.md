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

**Date:** 2026-11-17 · **Status:** accepted; memory TTL made configurable and misses shortened
by D24; KV is no longer filled by lookups and has no expiry (D25)

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

**Date:** 2026-11-17 · **Status:** superseded by D20. Cloudflare Access is now the only
sign-in; the built-in OIDC flow was removed. The reasons for not implementing SAML in the
Worker still hold.

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

**Date:** 2026-11-17 · **Status:** superseded by D20. Cloudflare Access owns sessions; Cairn
sets no cookies.

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

**Date:** 2026-11-17 · **Status:** partly superseded by D13 (prefix) and D14 (several servers).
D15 briefly gave the extension a sign-in token; D20 removed it, so "stores no credentials"
holds again, with the Cloudflare Access session in place of Cairn's cookie. The redirect
mechanism and permission model below still stand.

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

**Date:** 2026-11-17 · **Status:** superseded by D18. Clicks are no longer counted in D1.

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

After D20 the server tests sign real RS256 tokens with a stand-in for the Access team's key
(including key rotation, forged, unsigned, expired and wrong-audience tokens). The extension was
run in Chromium against a local imitation of Access: a proxy that redirects signed-out requests
to a login page on another site and sets a `SameSite=Lax` session cookie. It confirmed that the
extension's own API calls, including the popup's create from its `chrome-extension://` origin,
carry that cookie, and covered sign-in, sign-out and a missing `/_/config` bypass.

For D23 the run covered choosing shared before a server is set, setting the server and signing
in, switching modes from settings and from the popup, and migrating both shapes of the old
server list.

For D21 and D22 the extension was run in Chromium again: local mode from a fresh install
(unknown name, creating from the popup and from the manage page, pass-through and query
strings, edit, search, delete), then adding a server behind the imitation of Access, switching
between it and local mode from the popup, and removing it. The shared link rules have unit
tests (`extension/test`), run in CI.

**Not yet verified.** Real Cloudflare Access (its cookie settings, session duration and group
claims), Chrome's permission prompt itself (the test build pre-granted the hosts,
since headless Chrome cannot click the prompt), a deployment against a live Cloudflare account and a live Okta tenant, and
how Chrome's address bar treats a typed `go/name` on first use (see README, "Using it").

---

## D13. The server decides the prefix

**Date:** 2026-11-17 · **Status:** superseded by D21. The prefix is fixed at `go`.

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

**Date:** 2026-11-17 · **Status:** superseded by D23. One server at most, alongside local mode.

**Decision.** The settings page keeps a list of servers. One is active; its prefix is the one
that redirects. The active server can be changed in settings or from the toolbar popup. The
list syncs with the Chrome profile; sign-ins do not.

**Why one at a time.** Two servers may use the same prefix (staging and production both on
`go`), so "all at once" would be ambiguous. A single explicit choice is predictable.

**Policy.** A `serverUrl` set through managed storage still pins the server and hides the list
controls. The user only signs in.

---

## D15. The extension signs in once and holds a revocable token

**Date:** 2026-11-17 · **Status:** superseded by D20. The extension no longer has its own
sign-in; it uses the browser's Cloudflare Access session.

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

## D16. Emit clicks as an OpenTelemetry metric; link out to a dashboard

**Date:** 2026-11-17 · **Status:** superseded by D17. The research below still informed it.

**Context.** Click counts should be an OpenTelemetry metric, and "see metrics" for a link
should open a configured dashboard. Two questions were open: can Cloudflare do this in-product,
and how deeply can a metrics platform be integrated back into Cairn.

**What was checked.**

- *Cloudflare's built-in OpenTelemetry export* sends Worker traces and logs to any OTLP
  endpoint, but not custom metrics; Cloudflare's docs say metrics export is not available yet.
  So it cannot carry a click counter today.
- *Workers Analytics Engine* is Cloudflare's in-product collector for custom data points
  (`writeDataPoint`, a SQL API, a free allowance of about 100k points a day). It has no
  dashboards of its own to share with a team; the documented route is to query it from Grafana.
  It is also not OpenTelemetry, so it would not satisfy the request by itself.
- *OTLP platforms* (Grafana Cloud, Datadog, New Relic, Honeycomb, Dynatrace) all accept
  OTLP/HTTP directly, but disagree on how counters must be reported. Prometheus-based backends
  such as Grafana Cloud expect cumulative totals. Dynatrace accepts only deltas. Datadog and
  New Relic take either and prefer deltas.

**Decision.**

1. When an OTLP endpoint is configured, every redirect sends one data point for the metric
   `cairn.link.clicks` (a monotonic sum, attribute `link.slug`, resource `service.name`)
   straight from the Worker, after the response, in `ctx.waitUntil`.
2. Configuration uses the standard OpenTelemetry variable names
   (`OTEL_EXPORTER_OTLP_ENDPOINT`, `..._HEADERS`, `..._METRICS_TEMPORALITY_PREFERENCE`,
   `OTEL_SERVICE_NAME`), so vendor setup guides apply as written.
3. Both temporalities are supported. **Cumulative is the default**, as in the OpenTelemetry
   SDKs. The value is the link's running total from D1 (`UPDATE ... RETURNING clicks`), with the
   link's creation time as the start time. `delta` sends a `1` per click.
4. `METRICS_DASHBOARD_URL` is a URL template; `{slug}` is replaced with the link name. When
   set, the usage count in the UI becomes a link to that dashboard, and the API returns it as
   `metrics_url` on every link.
5. (Later removed by D18.) The D1 counter stays. It is what the UI shows without any metrics platform, and it is what
   makes cumulative reporting possible.

**Why these choices.**

- *Why the D1 total matters for cumulative.* A Worker has no memory between requests and runs
  as many isolates at once, so it cannot keep a running total itself. Most serverless code can
  therefore only send deltas, which Prometheus-style backends reject without a collector in
  between. Because D1 already holds one authoritative count per link, Cairn can report a true
  cumulative value from any isolate and work with Grafana Cloud directly.
- *Why hand-written protobuf.* Binary protobuf is the one encoding every OTLP receiver must
  accept; JSON is optional and not accepted everywhere. The message has a fixed shape, so about
  40 lines of encoder avoid a protobuf dependency (D11). The output was decoded with the
  official `opentelemetry-proto` package and is pinned by a byte-for-byte test.
- *Why one request per click rather than batching.* Buffering in memory would lose counts
  whenever an isolate is recycled. One small request per click, off the response path, is exact
  and simple. At very high volume, point the endpoint at an OpenTelemetry Collector and batch
  there.
- *Why a link out rather than charts inside Cairn.* Every platform can be reached by a URL with
  a variable in it; that is the only integration that works for all of them. See "Deeper
  integration" below.

**Limits.**

- A failed export is logged and dropped; there is no retry. In cumulative mode the next click
  carries the correct total, so nothing is lost. In delta mode that click is missing from the
  platform (D1 still has it).
- In cumulative mode, two clicks on the same link in the same instant can arrive out of order;
  backends drop the older sample and the total remains right.
- One time series per link. A few thousand links is well within any platform's limits.
- The D1 write per redirect, and with it the free-tier ceiling in D10, remains.

**Deeper integration, not built.**

- *Embedding charts in the Cairn UI.* Possible per vendor (Grafana panel embeds or public
  dashboards, Datadog embeddable graphs), each with its own auth and iframe rules, and it would
  mean relaxing Cairn's Content-Security-Policy for that vendor.
- *Reading numbers back* (for example a 30-day sparkline) needs each vendor's query API and a
  read credential on the Worker. There is no vendor-neutral query standard to build against.
- *Analytics Engine as a second sink* would give time series with no outside account, queried
  through Cloudflare's SQL API. Worth adding if someone wants history without a metrics
  platform.

---

## D17. Clicks are structured log events, shipped by Cloudflare

**Date:** 2026-11-17 · **Status:** accepted · **Supersedes:** D16

**Decision.** Each visit to a link writes one log line: a single object with flat, dotted keys
(`event.name: cairn.link.click`, `link.slug`, `link.found`, `link.target_host`,
`link.passthrough`, `client.kind`, `client.country`). The Worker no longer sends OTLP metrics.
Cloudflare's built-in OpenTelemetry *logs* export forwards the lines to the platform named in
`observability.logs.destinations`, and the platform derives counts from them.
`METRICS_DASHBOARD_URL` and the D1 counter are unchanged. (D18 later removed the D1 counter.)

**Why events instead of a metric.**

- *No exporter in Cairn.* D16 needed a hand-written protobuf encoder, per-vendor auth secrets,
  a temporality setting, and one outbound request per click. All of that is gone. Cloudflare
  already ships logs off the request path and retries on its side.
- *No temporality question.* A counter must be cumulative or delta, and platforms disagree on
  which they accept. Counting log events works the same everywhere.
- *More questions answerable.* A metric with one label answers "how many clicks per link". The
  event can also say which names people try that do not exist, whether the extension or a
  plain browser was used, and from which country, without new code.
- *Useful with no platform at all.* The events are queryable in Workers Logs in the Cloudflare
  dashboard as soon as they are deployed.

**Field choices.**

- *Flat dotted keys* (`link.slug`, not `{link: {slug}}`), in OpenTelemetry attribute style, so
  they stay addressable whether the platform turns them into attributes or parses a JSON body.
- *One object argument to `console.log`*, not a string, so Workers Logs indexes each field.
- *The destination host only, never the full URL*, and never the text passed through after the
  name or the query string. These can carry document IDs, search terms or tokens.
- *No user identity.* "Who used which link" is a privacy decision a company should make
  deliberately. Adding `user.email` is a one-line change if wanted.
- *Misses are logged* (`link.found: false`); visits by people who are not signed in are not, as
  those never reach the lookup.

**Trade-offs.**

- *Exactness depends on sampling.* Counts are exact only with
  `observability.logs.head_sampling_rate: 1`, which is the configured default.
- *Volume.* One log line per visit, plus Cloudflare's own invocation log line unless
  `invocation_logs` is turned off. Log-priced platforms charge for both; at go-link volumes this
  is small, but it scales with use in a way a pre-aggregated metric does not.
- *Cost.* Cloudflare may require the Workers Paid plan to export to a third party; check
  current pricing. Workers Logs in the dashboard is available without an export.
- *Not verified here.* Cloudflare's documentation site is blocked from the environment this was
  built in. The configuration was checked against Wrangler's own schema and a dry-run deploy,
  and the event format against local `wrangler dev` output. How Cloudflare maps the object's
  fields into the exported OTLP record (attributes or JSON body) was not confirmed against a
  live destination; the README asks deployers to check one record before building dashboards.

**What changed in the code.** `src/otel.ts` and its tests were removed. `src/events.ts` builds
and logs the event and holds `metricsUrl`. `recordClick` is back to a plain D1 update. The
`OTEL_*` settings were removed from `wrangler.jsonc`, and an `observability.logs` block was
added.

---

## D18. Stop counting clicks in D1; usage lives in the metrics platform

**Date:** 2026-11-17 · **Status:** accepted · **Supersedes:** D10 · **Amends:** D17

**Decision.** Redirects no longer write to D1. The `cairn.link.click` log event (D17) is the
only record of a visit. Migration `0003` drops the `clicks` and `last_clicked_at` columns. The
API no longer returns them, and the UI's usage column is replaced by a **Metrics ↗** link in
each row's actions. It only appears when `METRICS_DASHBOARD_URL` is set.

**Why.** Keeping both meant counting every click twice, in two places that would drift apart.
Cairn's own counter only fed a number in its UI. The product owner chose to give that up and
look at usage in the metrics platform instead. In return:

- *The redirect path is read-only.* A warm redirect touches memory or KV and nothing else. D1 is
  only read on a cache miss, and only written when someone edits a link.
- *No click-driven D1 ceiling.* D10's limit of about 100k redirects a day on D1's free tier is
  gone. The remaining per-click cost is a log line.
- *Less code.* `recordClick` and its `waitUntil` are removed.

**Trade-offs.**

- *No usage numbers inside Cairn.* People cannot sort or spot dead links in the Cairn UI. They
  follow the Metrics link instead.
- *Without a metrics platform there are no usage numbers anywhere* except Workers Logs in the
  Cloudflare dashboard, and only for as long as Cloudflare retains logs.
- *The migration deletes data.* On a deployment that already collected counts, applying `0003`
  removes them. The README warns about this. The project had not been deployed when this was
  decided.

**Future.** Bring usage back into Cairn through a provider-agnostic query API. Candidates to
evaluate then: a Prometheus-compatible query endpoint (PromQL over HTTP, which Grafana Cloud,
Datadog, New Relic, Dynatrace and most self-hosted stacks expose in some form), or Cloudflare's
own Workers Logs query API, which would need no third party. The returned numbers should be
cached, not stored as a second source of truth. Neither has been checked yet.

---

## D19. Separate events for creating, updating and deleting links

**Date:** 2026-11-17 · **Status:** accepted; emails in these events replaced by user IDs (D27)
· **Extends:** D17

**Decision.** Alongside `cairn.link.click`, the API logs `cairn.link.create`,
`cairn.link.update` and `cairn.link.delete`, in the same flat dotted-key style and through the
same Cloudflare log export. Each carries `link.slug`, `link.owner`, `link.target_host`,
`link.has_description`, `link.has_placeholder`, `user.email`, `user.admin_override` and
`client.kind`. Updates add `link.changed` (comma-separated field names) and, when relevant,
`link.previous_target_host` and `link.previous_owner`.

**Why separate event names** rather than one `cairn.link.change` with an action field: each is
a different question ("how many links were created this month", "who keeps editing go/wiki"),
and a distinct `event.name` is the one field every platform can filter on cheaply.

**Choices.**

- *Who acted is recorded*, unlike for clicks (D17). Clicks say what someone was reading;
  changes to a shared namespace are actions on everyone's links, and an audit trail is the
  point. Link owners' emails are already visible to everyone signed in to Cairn. Remove
  `user.email` in `src/events.ts` if your policy says otherwise.
- *Destinations are reduced to their host*, as for clicks. A full URL can carry document IDs
  or tokens. The trade-off: the log shows that `go/wiki` moved from `old.test` to `new.test`,
  but not which page.
- *Only real changes are logged.* A save that changes nothing, a refused change (wrong owner,
  name taken, invalid input) and a failed write produce no event.
- *Delete is included* though only create and update were asked for: it completes the lifecycle
  and costs one line.
- *`link.changed` is a string, not an array*, so it is a plain attribute on every platform.

**Not done.** These events are a log, not a restorable history: they cannot be used to undo a
change. An in-app edit history remains under "Deferred".

---

## D20. Cloudflare all the way: Access is the only sign-in

**Date:** 2026-11-17 · **Status:** accepted; Access on the Worker (`ctx.access`) is now preferred,
with this JWT check as the fallback (D26) · **Supersedes:** D4, D5, D15

**Context.** Cairn had two production sign-in modes: its own OIDC flow (with signed session
cookies, and a token the extension obtained once) and Cloudflare Access. The project has
committed to Cloudflare, so the provider-agnostic path is no longer worth its weight.

**Decision.** Cloudflare Access in front of the hostname is the only production sign-in. The
Worker verifies the `Cf-Access-Jwt-Assertion` header on every request and does nothing else
about identity. Removed: the OIDC login and callback, session cookies, the extension sign-in
flow and its tokens (migration `0004` drops the table), the token revocation API, and the
`OIDC_*`, `SESSION_*` and `EXTENSION_TOKEN_TTL_DAYS` settings. `AUTH_MODE=dev` stays, for local
development on localhost only. `workers_dev` and `preview_urls` are off, so the Worker is only
reachable on the hostname Access protects.

**Why.**

- *Less security-critical code.* About 400 lines of sign-in, session and token handling (net) are
  gone, along with every secret Cairn held. What remains is one token check.
- *One place to manage access.* Who may use Cairn, which identity provider (SAML or OIDC), how
  long sessions last, and revoking sessions all live in Zero Trust alongside the company's other
  internal apps.
- *Offboarding improves.* D15's 30-day extension tokens outlived removal from the identity
  provider unless an admin revoked them. Access sessions can be revoked centrally and last at
  most as long as the application's session duration.

**"Authenticate once" is now Access's session.** The extension holds no token. Redirects are
ordinary page loads that carry the Access cookie, and the extension's own API calls send it too
(tested against a local imitation of Access; see D12). Set the Access application's session
duration to decide how often people sign in again; the maximum is one month. When a session
expires, the next link visit goes through the identity provider and back, usually without a
prompt if the provider's own session is still alive.

**Consequences.**

- *(Removed by D21.)* *`/_/config` needs a Bypass policy.* The extension reads the prefix before anyone has signed
  in. Behind Access that request is redirected to the login page, so the README asks for a
  separate path-scoped Access application with a Bypass policy for `/_/config`. Without it, the
  extension tells people to sign in to the server in a tab first, which also works.
- *Group-based admins depend on Access configuration.* Access tokens only carry groups if the
  identity provider in Zero Trust is set to pass them as a custom claim. Cairn reads `groups`
  at the top level or under `custom`; which one a real Access setup produces was not confirmed.
  `ADMIN_EMAILS` does not depend on it.
- *Clicks no longer say whether the extension was used.* That came from the extension's token.
  Link changes still do, from the popup's `chrome-extension://` origin.
- *Service tokens are refused.* Access service tokens carry no email, and every Cairn action is
  tied to a person.
- *Moving off Cloudflare later* would mean reintroducing a sign-in. The removed code is in git
  history (D4, D5, D15).

**On user IDs** (open from the discussion of D19): in this setup the stable ID available is
Access's own `sub` for the person, not the identity provider's. Resolved by D27, which uses
Cairn's own random IDs instead.

---

## D21. The prefix is always `go`

**Date:** 2026-11-17 · **Status:** accepted · **Supersedes:** D13

**Decision.** `LINK_PREFIX` and the `/_/config` endpoint are removed. Links are always
`go/name`, on the server, in the web UI and in the extension.

**Why.** A custom prefix cost more than it gave:

- The extension had to learn the prefix before anyone signed in. Behind Cloudflare Access that
  needed a separate Bypass application for `/_/config`, which wrangler cannot create, so every
  deployment had a manual Zero Trust step that was easy to miss.
- Any prefix other than `go` needed an extra Chrome permission prompt, and a "Grant access"
  recovery path when the prefix changed.
- The address-bar keyword (`go` + space) could never follow the prefix anyway, since Chrome
  fixes it in the manifest.

With `go` fixed, the extension's permission to `*://go/*` ships in the manifest, the only
permission requested at runtime is the server's own origin, and a server is checked by asking
who is signed in (`/_/api/me`) instead of reading a public config endpoint.

**Revisit if** a company already uses `go/` for something else on its network. Forking the
extension and changing the two places it appears (`manifest.json` and the redirect rule in
`background.js`) is the escape hatch.

---

## D22. Local mode: links stored in the browser

**Date:** 2026-11-17 · **Status:** accepted; the choice of backends is simplified by D23

**Decision.** The extension can work with no server. "This browser" is one of the choices in
settings and in the popup, alongside any Cairn servers, and it is the default until a server is
chosen. Local links live in `chrome.storage.local` under one key.

**How redirects work locally.** The single redirect rule points `go/<path>` at the extension's
own `go.html#<path>` instead of a server. That page looks the name up and replaces itself with
the destination, or with the extension's "new link" page if the name is unknown. Chrome allows
a `declarativeNetRequest` redirect to an extension page with the path kept; this was checked in
a test extension first. The page is web-accessible only to `go/` URLs.

**Choices.**

- *Same rules as the server.* Name validation, URL validation and `{*}` pass-through are ported
  to `extension/golinks.js`. Its tests reuse the server's cases, so a link behaves the same in
  either place.
- *`storage.local`, not `storage.sync`.* Sync is capped at about 100 KB in total and 8 KB per
  item, which a few hundred links would exceed, and conflicting edits across devices would need
  merge rules. Local is per-profile and roomy.
- *Local is the default.* A fresh install works immediately. Under an enterprise policy that
  pins a server, local mode is not offered.
- *No ownership, metrics or events.* There is one person; nothing is logged or sent anywhere.

**Popup creation.** Creating a link from the toolbar popup already existed for servers. It now
saves to whichever backend is active, locally or on the server, and shows a "Save to" choice
when there is more than one.

**Not built.** Import and export (for example, moving local links to a server), and syncing
local links across devices.

---

## D23. Local or shared: one server, not a list

**Date:** 2026-11-17 · **Status:** accepted · **Supersedes:** D14

**Decision.** The extension offers exactly two modes: **this browser** (local, D22) and
**shared**, which uses a single Cairn server. Settings show the two as a choice, with the
server's URL entered inside the shared option. The popup's switch has at most those two
entries. Storage is `{ mode, serverUrl }` in `storage.sync`.

**Why.** A list of servers served staging-versus-production setups, which few companies running
one go-link server need, and it cost a list UI, add/remove flows and a more complicated popup.
With one server the settings page reads as a single question: where do your links live?

**Details.**

- *Shared can't be chosen before a server is set.* Picking it without one keeps local mode and
  moves focus to the URL field.
- *Switching keeps both sides.* Moving between local and shared changes which one answers `go/`;
  local links stay in the browser and the server stays configured.
- *Policy still wins.* A managed `serverUrl` forces shared mode and hides local mode.
- *Migration.* Versions 0.2 to 0.4 stored `{ backends, active }`. On update the extension keeps
  the server that was in use (or else the first one) as the shared server, keeps the mode that
  was in effect, and removes the old keys. Any other servers in the list are dropped.

---

## D24. Configurable redirect cache TTL; short-lived misses

**Date:** 2026-11-17 · **Status:** accepted · **Amends:** D3

**Decision.** The in-memory layer's TTL is `REDIRECT_CACHE_SECONDS`: default 30, range 0 to
3600, with `0` turning that layer off. Unknown names are remembered for at most 5 seconds
(or not at all when the setting is 0), whatever the setting.

**Why 30 seconds by default.** The memory layer saves a KV read, which is already fast and
cheap, so a long TTL buys little. Its real job is absorbing bursts (a link pasted into a big
channel). Thirty seconds does that and keeps an edit's worst case at about 90 seconds once KV
propagation is added. Longer TTLs suit a company whose links almost never change; shorter ones
suit people who edit a link and immediately test it from another browser.

**Why misses get their own, shorter TTL.** Before this, an unknown name was remembered as long
as a real link. Someone trying `go/x`, then a teammate creating it, meant that instance kept
offering the "create" form for up to 30 seconds. Five seconds still absorbs repeated typos.
Not caching misses at all was tried and reverted: the 5 seconds is worth keeping to absorb
repeated lookups of the same typo. Misses stay out of KV: KV entries cannot expire sooner than
60 seconds, and every cached miss would spend one of the free tier's 1,000 daily writes.

**What the setting does not control.**

- *KV propagation.* After an edit, other Cloudflare locations can read the old value from KV for
  about a minute. That is KV's own edge caching; the setting cannot lower it.
- *KV's 7-day expiry* (removed by D25) was a backstop. If a KV write failed during an edit, the
  old destination could be served for up to 7 days. D25 closes that by refusing the edit.

---

## D25. Fixes from the first code review

**Date:** 2026-11-17 · **Status:** accepted · **Amends:** D3, D22, D24

An automated review of PR #1 found ten problems. Nine were fixed as described; for the tenth
(Chrome policy format) the reviewer's suggested change was not made, for the reason given.

**Server**

- *Stale writes.* The API checked permission against a row it read before the request body
  arrived, then updated or deleted by name only. A delayed request could undo an ownership
  handover or delete a link someone had since recreated. Each link now has a `rev` that
  changes on every write (migration `0005`), and `UPDATE` and `DELETE` only apply to the `rev`
  that was checked. Clients may also send the `rev` they last saw (the web UI does) to get a
  `409` instead of overwriting a change made after they loaded the page.
- *Stale cache fills.* A lookup that missed KV read D1 and wrote the result to KV. If an edit
  happened in between, that late write put the old destination back, for up to 7 days. Now
  only changes write KV: they delete the entry first and refuse to go ahead (`503`) if they
  cannot, then write the new value; if that last write fails, reads fall back to D1, which is
  correct, just slower. Lookups never write KV, and entries no longer expire, since only
  changes write them.
  Cost: a link created before this change, or whose post-edit write failed, is read from D1
  (with the memory cache) until it is next edited. One residual race remains: two edits to
  the same link within the time it takes to write KV can leave the first edit's value in KV.
  The `rev` check makes one of two overlapping edits fail, which narrows this to edits made
  one after the other within milliseconds.
- *Reserved names.* `robots.txt` and `favicon.ico` are answered by the router, so links with
  those names could never be followed. They are now rejected.
- *Destinations.* Redirects returned the stored text. `https:example.com` passes URL validation
  but is a relative reference in a `Location` header, and non-ASCII paths cannot be sent in a
  header at all. Destinations are now serialized through `URL` (in the extension too).
- *List limit.* `?limit=-1` reached SQLite as a negative `LIMIT`, which means no limit. It is
  clamped to a whole number from 1 to 500.

**Extension**

- *Lost local edits.* Each local change read the whole dictionary, changed it and wrote it
  back, so two pages saving at once could erase each other's change. Changes now run under a
  Web Lock shared by all extension pages. A browser test creating, editing and deleting from
  two pages at once lost data without the lock and none with it.
- *Inherited names.* The local dictionary was a plain object, so `go/constructor` matched a
  built-in property. It is now read into an object with no prototype.
- *Address-bar paths.* `go bug/ABC-12` was sent as one encoded name. Slashes, query strings
  and existing `%` escapes are now kept; spaces still become slashes.
- *Local list links* went through `http://go/`, which follows whichever mode is active. They
  now open the local resolver directly.

**Not changed: the Chrome policy example.** The review said the `3rdparty` JSON needs a
`policy` object around the extension's settings. That level exists in the Windows registry
layout (`...\extensions\<id>\policy`), but Chromium's administrator documentation maps the
extension ID straight to its settings in the JSON layout. A local test was inconclusive: the
headless Chromium here did not load extension policies in either shape. The README now shows
the Admin console, Windows and Linux forms separately and asks admins to confirm with
`chrome://policy`.

---

## D26. Install with the Deploy to Cloudflare button

**Date:** 2026-11-17 · **Status:** accepted · **Amends:** D20

**Decision.** The README has a Deploy to Cloudflare button pointing at `server/`. To make the
result work with no configuration editing:

- *No resource IDs in `wrangler.jsonc`.* Wrangler creates the D1 database and KV namespace on
  the first deploy, named after the Worker, and reuses the bound ones on later deploys.
  Existing installs keep their resources for the same reason. Migration commands find the
  database by its binding name (`DB`).
- *Migrations in the deploy script.* `npm run deploy` (which the button runs) applies
  migrations before deploying when the database exists, so new code never meets an old schema.
  On a first install, where the database only appears during the deploy, it deploys and then
  migrates. The few seconds before the first migration see errors; nobody can sign in yet then.
- *Access on the Worker, read from `ctx.access`.* Since August 2026 Access can be turned on for
  a Worker directly. The runtime then provides `ctx.access.getIdentity()`, groups included, so
  Cairn needs no team domain or AUD tag, and `ADMIN_GROUPS` works without custom claims.
  Identities are cached per Access token for 60 seconds per isolate. The D20 path, verifying
  the JWT from a separate Access application, stays as a fallback when `ACCESS_TEAM_DOMAIN`
  and `ACCESS_AUD` are set. With neither, every request is refused with instructions.
- *`workers_dev` back on.* A button install has no custom domain, so `workers.dev` is its first
  address. Access on the Worker covers it, and Cairn refuses unsigned requests regardless.
  Preview URLs stay off; reports suggest Access does not provide `ctx.access` there.

**Not verified.** This environment has no Cloudflare account. Resource creation and lookup by
name were read from Wrangler's source, the deploy script was run against a stand-in for
Wrangler, and `ctx.access` was simulated in tests from its published types. The first real
button install should confirm: resources created, migrations applied, `ctx.access` present on
`workers.dev` and on a custom domain, and group names as `getIdentity()` reports them.

---

## D27. People are random IDs; emails live only in a `users` table

**Date:** 2026-11-17 · **Status:** accepted · **Amends:** D19

**Decision.** A new `users` table maps a random ID (128 bits, hex) to an email. Events carry
`user.id`, `link.owner_id` and `link.previous_owner_id` instead of emails, and links store the
owner's ID (`links.owner_id`). The API and UI still show owners' emails, read from `users`.
Migration `0006` creates the table from the existing owners and fills `owner_id`. Click events
are unchanged: they never identified anyone.

**Why random IDs.**

- *Not a hash of the email.* A plain hash can be reversed by hashing a list of likely emails
  (the company directory). A keyed hash avoids that but adds a secret to manage, and anyone who
  ever holds the key can reverse every log line.
- *Not Access's user ID.* Links can be handed to any email, including people who have never
  signed in, and Access has no ID for them. Its `sub` also differs between the two Access
  setups Cairn supports (D26).
- *A random ID means nothing outside Cairn.* Logs can go to a third-party platform without
  disclosing who did what. Reading them needs access to Cairn's D1 database.
- *It allows forgetting someone.* Deleting a person's `users` row leaves every log line about
  them pointing at an ID that no longer resolves.

**Why links store the ID too.** The request was IDs in events plus a lookup table for the UI.
Storing IDs in `links` as well means, once the old column is gone, an email exists in exactly
one row, so changing or removing it is one update.

**Rolled out in two steps (expand, then contract).** The deploy script migrates before it
deploys (D26), so for a moment the previous Worker version runs against the new schema, and if
the deploy fails it keeps running. Dropping `links.owner` in the same release would break that
version's writes, and rolling the Worker back would not bring the column back. So:

- *This release (expand):* migration `0006` only adds. The new code writes both `owner_id` and
  the old `owner` column, reads the email from `users` (falling back to `owner` for a row the
  previous version wrote mid-upgrade), and gives such a row an ID on its first change.
- *The next release (contract), migration `0007`:* fills any missing `owner_id` (a row the
  pre-`0006` version wrote mid-upgrade), drops `links.owner`, removing every stored email, and
  re-adds it empty and optional so the `0006` version's writes still succeed while it runs
  during the upgrade. The new code never reads or writes it. Since nothing uses the leftover
  column, any later release can drop it outright.

Who is acting is looked up before a link is changed, so a failure there can no longer follow a
committed change and lose its event.

**Details.**

- *IDs are created on first need:* creating a link, being handed one, or listing "only mine".
  Redirects and reads never touch `users`, so the redirect path is unchanged.
- *One statement* (`INSERT … ON CONFLICT (email) DO UPDATE … RETURNING id`) both creates and
  looks up an ID, so two requests for a new email at once get the same ID.
- *Not cached.* Lookups happen only on link changes and "only mine" listings; a cache could
  hand out the ID of a row that has since been removed.
- *Emails are compared lowercase,* as before.

**Not built.** A way to delete or rename a user (for example on offboarding or a changed
email), and showing IDs in the UI. Deleting a row today would leave that person's links with
no visible owner, so it needs a decision on who inherits them first.

---

## D28. Tracing with the runtime's spans plus a few of Cairn's own

**Date:** 2026-11-17 · **Status:** accepted

**Decision.** `observability.traces` is enabled at 10% head sampling. The Workers runtime traces
each request and every KV, D1 and `fetch` call itself. Cairn adds three spans through the
runtime's own span API (`tracing.enterSpan` from `cloudflare:workers`), wrapped in
`src/tracing.ts`:

- `cairn.link.lookup` with `cache.layer` (`memory`, `kv`, `d1`) and `link.found`, the main
  performance signal for redirects;
- `cairn.auth` with `auth.method` and whether the Access identity came from the cache;
- `cairn.api` with method, route (link names replaced by `:slug`, so spans group by operation)
  and status.

Exceptions and rejected promises are recorded on the span and rethrown.

**Why this approach.** Of the options considered (runtime tracing, a Tail Worker acting as a
collector, the `otel-cf-workers` library), runtime tracing has no exporter code in Cairn and no
extra outbound requests: Cloudflare ships spans over OTLP, off the request path, to any platform.
A Tail Worker would add tail sampling (keep every slow or failed request) and scrubbing, at the
cost of code to maintain; worth adding if head sampling proves too coarse. The library would
duplicate what the runtime now does natively.

**Choices.**

- *10% sampling* because traces are for latency, not counting; logs stay at 100% for exact
  click counts (D17), and the two rates are independent.
- *No emails in spans*, matching D27. Attributes are link names, layers, methods, routes and
  status codes. Nothing a visitor types is recorded verbatim: a requested name that is not valid
  link syntax becomes `(invalid)` (also in the click log event, which recorded it as typed
  before), and unknown API paths become the route `unknown`. Recorded exceptions have emails
  redacted from message and stack, since some errors name the person ("x@y is not allowed").
  A test sends emails through each of these paths and checks nothing recorded contains `@`.
- *Testable without the runtime.* The wrapper accepts a recording tracer in tests. In the local
  runtime the real API works but records nothing, so calling it costs a function call.

**Not verified.** The span API is recent (June 2026). What a real export looks like (span
nesting under the runtime's spans, attribute names at the destination) needs a deployed Worker
with tracing on.

---

## D29. One stylesheet from the design system, shared by both UIs

**Date:** 2026-11-17 · **Status:** accepted · **Amends:** D11

**Decision.** The extension pages and the server's web UI use one set of plain CSS files in
`extension/ui/`, built from the Cairn design system: tokens, a base layer and one file per
component, joined by `cairn.css` in cascade layers (`tokens`, `base`, `components`). The Worker
imports the same files as text and binary modules and serves them under `/_/ui/`, with the
stylesheet's `@import`s inlined into one response at a fingerprinted URL.

**Why.**

- *One source.* The two UIs show the same things (the New link form, the links table) and
  should not drift. The extension can only load files inside its own folder, so that is where
  they live; the Worker reaches across at bundle time.
- *Tokens as data.* `design/tokens.json` is the design system's export. A script turns it into
  `tokens.css`; colours become `light-dark()` pairs, so each is declared once for both themes and
  follows `color-scheme` (the OS, or `data-theme` on `<html>`). A test keeps the file in step.
- *Still no build step* (D11). The extension loads `cairn.css` and its `@import`s directly, which
  costs nothing from local files; the server inlines them once when the Worker starts.
- *Cascade layers* keep specificity flat: component rules never fight the base layer, and a
  page's own unlayered rules always win without `!important`.
- *Stricter CSP for the server UI.* Styles, fonts and images come from the Worker itself, so the
  policy is `style-src 'self'` instead of `'unsafe-inline'`. Fonts are bundled, never fetched
  from a font CDN, as the design system asks.
- *The topographic footer is a mask*, not 35 KB of inline SVG on every page: `topo.svg` masks a
  `--topo-line` fill, so it follows the theme.

**Also.** Theme and density are now settings on the extension's options page, stored in the
extension's `localStorage` and applied before first paint by `ui/display.js`. The server UI
follows the OS theme at the default density. The minimum Chrome version is now 123, for
`light-dark()`.

**Not built.** The design system's keyboard row selection (`j`/`k`, `e`), Undo in place of the
delete confirmation, editing in the New link card instead of a dialog, middle truncation of long
URLs, and theme and density controls on the server UI.

---

## D30. Svelte and Vite for both UIs; the server's UI as static assets

**Date:** 2026-11-17 · **Status:** accepted · **Supersedes:** D11 (no build step for the UI) ·
**Amends:** D29

**Decision.** The extension's pages and the server's web UI are Svelte 5 apps built by Vite into
static files. Shared components live in an npm workspace package, `ui/`; the server's app is
`web/`; the extension builds into `extension/dist/`. The Worker no longer contains UI code: Vite
writes the server UI into `server/public/_/`, Workers Static Assets uploads it with the Worker,
and the Worker serves it from the `ASSETS` binding after signing the request in.

**Why.**

- *One manage page, not two.* The New link card, search, links table and edit dialog existed
  twice, in `extension/links.js` and in the script inside `server/src/ui.ts`, differing only in
  where links come from. Now they are one component, `LinksPage.svelte`, which talks to a
  `LinkSource`: local storage in the extension, the API on the server. Each new design-system
  feature (keyboard selection, Undo, editing in the card) is now written once.
- *Styles live with their components.* Each `.svelte` file carries its own scoped styles. Only
  tokens, fonts, element defaults and a few primitives (labels, hints, the text-control box,
  kbd) stay global. That replaces D29's hand-maintained list of component stylesheets, and the
  Worker importing them across directories.
- *The Worker shrinks to what must be code:* sign-in, the API and redirects. Its bundle went
  from about 190 KiB to 27 KiB. The page's CSP is now a fixed `'self'` policy set in
  `src/ui.ts`; Vite emits no inline scripts or styles, so the per-request nonce is gone.
- *Svelte, not a larger framework.* It compiles to small plain JavaScript (about 24 KiB gzipped
  for the server UI, fonts aside). It needs no `eval` and no runtime downloads, which suits the
  extension's content-security rules. *Plain Vite, not SvelteKit*: Cairn has one server page
  and three extension pages, so it needs no router. SvelteKit's Cloudflare adapter would also
  put rendering back inside the Worker.

**Signing in before every file.** `run_worker_first: true` sends every request to the Worker,
which checks sign-in before handing a `/_/` path to `env.ASSETS`. Static Assets can serve files
without running the Worker at all, but Cairn turns Access on for the Worker itself (D26). This
session could not reach Cloudflare's documentation to confirm whether that Access setting also
covers asset requests the Worker never sees. So the UI is not left to that: as before, nothing
under `/_/` is served to someone Cairn has not signed in (D6), and tests check it. The cost is
one Worker invocation per UI file, as before this change. Revisit once Access's coverage of
static assets is confirmed, if those invocations matter.

**Caching.** Vite puts a content hash in every file name under `/_/assets/`, so those are cached
for a year (`private, immutable`). `index.html` is `private, no-cache`.

**Costs, accepted.**

- *A build step.* `npm run build` at the root (CI does it). For the server, the build is
  Wrangler's own `build.command` (`scripts/build-ui.mjs`), so every `wrangler deploy` and
  `wrangler dev` builds the UI first, however it is started. That includes the Deploy to
  Cloudflare button and a deploy command changed to plain `npx wrangler deploy`. The script
  installs the root's tools first when a fresh checkout has none. A copy of the repository with
  nothing installed and nothing built was checked this way with `wrangler deploy --dry-run`
  from `server/`. Node is pinned to 22 in `.node-version` (at the root and in `server/`, where
  the button's build starts), because Vite needs 22.12 or later.
- *The extension must be built before loading it unpacked:* load `extension/dist/`, not
  `extension/`. Its non-UI modules (`background.js`, `config.js`, `local.js`, `golinks.js`)
  are unchanged and still tested with `node --test`.
- *Development dependencies:* Svelte, Vite, svelte-check, Vitest, jsdom and Testing Library.
  None of them ship. What ships is the compiled output; the Worker still has no runtime
  dependencies.

**Not verified.** A real Deploy to Cloudflare install with the extra build step (in particular,
that the build image honours `.node-version` and allows the root `npm ci` the build script runs),
and Static Assets on a live account. Both were run locally with `wrangler dev` and `wrangler deploy --dry-run`.

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
