<script lang="ts">
  import GoName from "@cairn/ui/components/GoName.svelte";
  import Icon from "@cairn/ui/components/Icon.svelte";
  import UsageCard from "@cairn/ui/components/UsageCard.svelte";
  import { roadmapChanges, roadmapUses } from "../../ui/src/stories/fixtures";
  import Feature from "./parts/Feature.svelte";
  import Flow from "./parts/Flow.svelte";
  import SiteFooter from "./parts/SiteFooter.svelte";
  import SiteHeader from "./parts/SiteHeader.svelte";
  import Steps from "./parts/Steps.svelte";
  import { DECISIONS, DEPLOY, README, SERVER_SOURCE } from "./links";

  const root = "../";
  const rows = [
    { slug: "q4", owner: "you", url: "docs.example.com/planning/2026/q4-planning", ago: "just now", fresh: true },
    { slug: "bug", owner: "sam@", url: "tracker.example.com/browse/{*}", ago: "Jul 2" },
    { slug: "roadmap", owner: "maya@", url: "docs.example.com/product/plans/roadmap-2027#q1", ago: "2 days ago" },
    { slug: "oncall", owner: "you", url: "pager.example.com/teams/platform/schedules/sre", ago: "Oct 28" },
    { slug: "standup", owner: "priya@", url: "meet.example.com/rooms/eng/daily", ago: "Sep 9" },
    { slug: "handbook", owner: "lee@", url: "wiki.example.com/eng/team/handbook", ago: "Aug 14" },
  ];
  const click = `{
  "event.name": "cairn.link.click",
  "link.slug": "roadmap",
  "link.found": true,
  "link.target_host": "docs.example.com",
  "link.passthrough": false,
  "client.kind": "extension",
  "client.country": "GB"
}`;
  let range = $state<"7" | "30" | "90">("90");
</script>

<SiteHeader {root} current="server" />

<main>
  <section class="hero">
    <div class="s-wrap hero-inner">
      <span class="s-eyebrow">Server · Cloudflare Workers · self-hosted</span>
      <h1 class="s-display">One set of go links for the whole company.</h1>
      <p class="s-lede">
        Cairn’s server is where your people create, search and share links. It runs in your own
        Cloudflare account, signs people in with your identity provider, and redirects with no
        cold starts. Deploy it in one click.
      </p>
      <div class="s-actions">
        <a class="s-btn primary" href={DEPLOY}>
          Deploy to Cloudflare
        </a>
        <a class="s-btn" href="#setup">See the setup</a>
      </div>

      <div class="window" inert>
        <div class="win-bar"><span class="dots"><i></i><i></i><i></i></span><span class="win-url">go.example.com</span></div>
        <div class="win-body">
          <div class="toolbar">
            <span class="search"><Icon name="search" /> Search 214 links</span>
            <span class="new">New link</span>
          </div>
          <div class="table" role="presentation">
            <div class="th"><span>Name</span><span>Goes to</span><span class="hide-sm">Owner</span><span class="hide-sm">Changed</span></div>
            {#each rows as row (row.slug)}
              <div class="tr" class:fresh={row.fresh}>
                <GoName name={row.slug} />
                <span class="url">{row.url}</span>
                <span class="hide-sm muted">{row.owner}</span>
                <span class="hide-sm faint">{row.ago}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="features">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">For everyone</span>
        <h2 class="s-h2" id="features">Make a link once. Everyone can use it.</h2>
      </div>
      <div class="s-grid three">
        <Feature tag="directory" title="Search every link">
          Everyone signed in can search and use all links. Keyboard first: <kbd class="cn-kbd">j</kbd> <kbd class="cn-kbd">k</kbd> to move, <kbd class="cn-kbd">y</kbd> to copy, <kbd class="cn-kbd">e</kbd> to edit.
        </Feature>
        <Feature tag="ownership" title="Clear owners">
          Whoever makes a link owns it. Owners and admins can edit, delete or hand it over, and every change is recorded.
        </Feature>
        <Feature tag="unclaimed names" title="Ask for what’s missing">
          A name nobody has made opens the “new link” form with the name filled in, and lists similar links that already exist.
        </Feature>
        <Feature tag={'{*}'} title="Links with arguments">
          <code>tracker.example.com/browse/{'{*}'}</code> makes <GoName name="bug/ABC-12" /> open that ticket.
        </Feature>
        <Feature tag="safe edits" title="No lost changes">
          Each link has a revision. Save over someone else’s newer edit and Cairn stops and shows you, instead of overwriting it.
        </Feature>
        <Feature tag="anywhere" title="Works without the extension">
          <code>https://go.example.com/roadmap</code> works from any device, chat or doc. The <a href="../extension/">extension</a> adds the <code>go/</code> shorthand.
        </Feature>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="arch">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">For whoever runs it</span>
        <h2 class="s-h2" id="arch">Cloudflare, end to end. Nothing to host.</h2>
        <p class="s-lede">One Worker, one D1 database, one KV namespace, in your account. No containers, no VMs, no database server, and no cold starts.</p>
      </div>
      <div style="--n: 4"><Flow stops={[
        { who: "Cloudflare Access", what: "sign in", detail: "Okta, Entra ID, Google or any SAML or OIDC provider. Or a one-time code by email." },
        { who: "Worker", what: "go.example.com/…", detail: "Runs on Cloudflare’s network, near every person, with no cold starts." },
        { who: "Memory → KV → D1", what: "look up", detail: "Redirects cached per instance and in KV in front of a SQLite database." },
        { who: "Workers Logs", what: "count", detail: "One structured event per visit, ready to ship to your metrics platform." },
      ]} /></div>

      <div class="s-grid three facts">
        <div><span class="big">$0</span><p>Built to fit Cloudflare’s free tiers at company scale. Access is free for small teams; check pricing for your headcount.</p></div>
        <div><span class="big">0</span><p>Secrets to manage. Cairn holds no passwords, client secrets or signing keys, and refuses any request Access hasn’t signed in.</p></div>
        <div><span class="big">1</span><p>Click to deploy. The button creates the Worker, database and cache, sets up the tables, and redeploys on every push.</p></div>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="metrics">
    <div class="s-wrap s-split">
      <div class="s-section-head flush">
        <span class="s-eyebrow">Usage, privately</span>
        <h2 class="s-h2" id="metrics">See which links matter, not who clicked.</h2>
        <p class="s-lede">Every visit writes one OpenTelemetry-ready event. Cloudflare ships it over OpenTelemetry to the platform you already use, and each link in Cairn points to its own dashboard.</p>
        <p class="s-muted">No email address is ever logged. People appear as random IDs, and the event never holds the full destination. <code>link.found: false</code> tells you which links people expect but don’t exist yet.</p>
        <pre class="s-code">{click}</pre>
      </div>
      <div class="usage">
        <UsageCard days={roadmapUses} changes={roadmapChanges} bind:range source="Your metrics platform" />
      </div>
    </div>
  </section>

  <section class="s-section" id="setup" aria-labelledby="setup-h">
    <div class="s-wrap s-split top">
      <div class="s-section-head sticky">
        <span class="s-eyebrow">Setup</span>
        <h2 class="s-h2" id="setup-h">A few steps, mostly in the Cloudflare dashboard.</h2>
        <p class="s-lede">All you need is a Cloudflare account. Prefer the command line? <code>npm run deploy</code> in <a href={SERVER_SOURCE}><code>server/</code></a> does the same.</p>
        <div class="s-actions"><a class="s-btn primary" href={DEPLOY}>Deploy to Cloudflare</a><a class="s-btn" href={README}>Full guide</a></div>
      </div>
      <Steps steps={[
        { title: "Deploy", body: deploy },
        { title: "Turn on Cloudflare Access", body: access },
        { title: "Connect your identity provider", body: idp },
        { title: "Use your own hostname", body: domain },
        { title: "Make yourself an admin", body: admin },
      ]} />
    </div>
  </section>

  <section class="s-section closing">
    <div class="s-wrap closing-inner">
      <h2 class="s-h2">Give your company a shared memory for links.</h2>
      <div class="s-actions">
        <a class="s-btn primary" href={DEPLOY}>Deploy to Cloudflare</a>
        <a class="s-btn" href="../extension/">Pair it with the extension</a>
        <a class="s-btn" href={DECISIONS}>Read the design decisions</a>
      </div>
    </div>
  </section>
</main>

<SiteFooter {root} />

{#snippet deploy()}
  <p>The button copies <code>server/</code> into a new GitHub repository on your account, creates the Worker, its D1 database and KV namespace, and connects the repository so every push redeploys.</p>
{/snippet}
{#snippet access()}
  <p>In the Worker’s settings, enable Access and choose who may sign in: emails ending in <code>@example.com</code>, or a group from your identity provider. Until it’s on, Cairn refuses every request.</p>
{/snippet}
{#snippet idp()}
  <p>Optional. In Zero Trust → Settings → Authentication, add Okta, Entra ID, Google or any SAML or OIDC provider. Without one, Access signs people in with a one-time code by email.</p>
{/snippet}
{#snippet domain()}
  <p>Optional. Add a custom domain such as <code>go.example.com</code> to the Worker. Until then it’s reachable at its <code>workers.dev</code> address, still behind Access.</p>
{/snippet}
{#snippet admin()}
  <p>Set <code>ADMIN_EMAILS</code> or <code>ADMIN_GROUPS</code> in <code>wrangler.jsonc</code> and push. Add <code>ALLOWED_EMAIL_DOMAINS</code> for a second check on top of the Access policy.</p>
{/snippet}

<style>
  .hero { padding: clamp(48px, 8vw, 104px) 0 clamp(48px, 7vw, 88px); overflow: hidden; }
  .hero-inner { display: grid; justify-items: center; text-align: center; gap: var(--space-5); }
  .hero .s-lede { margin: 0 auto; }
  .hero .s-actions { justify-content: center; }

  .window {
    width: 100%; max-width: 960px; margin-top: var(--space-6); text-align: left;
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
    box-shadow: 0 40px 80px -30px rgb(35 33 29 / .3), var(--shadow-menu);
  }
  .win-bar { display: flex; align-items: center; gap: var(--space-4); height: 40px; padding: 0 14px; background: var(--surface-sunken); border-bottom: 1px solid var(--line); }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); }
  .win-url { flex: 0 1 320px; margin: 0 auto; padding: 3px 12px; border-radius: var(--radius-full); background: var(--surface); font: var(--type-url); color: var(--ink-muted); text-align: center; }
  .win-body { display: grid; gap: var(--space-4); padding: var(--space-5); background: var(--page); font-size: 14px; }
  .toolbar { display: flex; gap: var(--space-3); }
  .search {
    flex: 1; display: flex; align-items: center; gap: var(--space-2); height: 36px; padding: 0 var(--space-3);
    color: var(--ink-faint); background: var(--field); border: 1px solid var(--line-control); border-radius: var(--radius-md);
  }
  .new { display: inline-flex; align-items: center; padding: 0 14px; border-radius: var(--radius-md); background: var(--moss); color: var(--on-moss); font-weight: 500; }
  .table { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg); overflow: hidden; }
  .th, .tr { display: grid; grid-template-columns: 140px minmax(0, 1fr) 90px 100px; gap: var(--space-4); align-items: center; padding: 0 var(--space-4); }
  .th { height: 34px; font: var(--type-label); color: var(--ink-muted); background: var(--surface-sunken); border-bottom: 1px solid var(--line); }
  .tr { height: 44px; border-bottom: 1px solid var(--line); }
  .tr:last-child { border-bottom: 0; }
  .tr.fresh { box-shadow: inset 3px 0 var(--terracotta); background: var(--terracotta-soft); }
  .url { font: var(--type-url); color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .muted { color: var(--ink-muted); }
  .faint { color: var(--ink-faint); font-size: 13px; }
  @media (max-width: 640px) {
    .hide-sm { display: none; }
    .th, .tr { grid-template-columns: 96px minmax(0, 1fr); }
    .win-body { padding: var(--space-3); }
  }

  .facts { margin-top: clamp(40px, 6vw, 64px); }
  .facts div { display: grid; gap: var(--space-2); }
  .big { font: 600 56px/1 var(--font-sans); letter-spacing: -0.04em; color: var(--moss); }
  .facts p { color: var(--ink-muted); font-size: 15px; }

  .flush { margin-bottom: 0; }
  .flush .s-code { margin-top: var(--space-2); }
  .usage { min-width: 0; }
  .usage :global(> *) { box-shadow: 0 30px 60px -30px rgb(35 33 29 / .25); }

  .top { align-items: start; }
  .sticky .s-actions { margin-top: var(--space-2); }
  @media (min-width: 920px) { .sticky { position: sticky; top: 96px; } }

  .closing { text-align: center; }
  .closing-inner { display: grid; justify-items: center; gap: var(--space-6); }
  .closing .s-actions { justify-content: center; }
</style>
