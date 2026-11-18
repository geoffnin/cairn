<script lang="ts">
  import GoName from "@cairn/ui/components/GoName.svelte";
  import Kbd from "@cairn/ui/components/Kbd.svelte";
  import OmniboxPreview from "@cairn/ui/components/OmniboxPreview.svelte";
  import ToolbarPopup from "@cairn/ui/components/ToolbarPopup.svelte";
  import Feature from "./parts/Feature.svelte";
  import SiteFooter from "./parts/SiteFooter.svelte";
  import SiteHeader from "./parts/SiteHeader.svelte";
  import Steps from "./parts/Steps.svelte";
  import { README, RELEASES, REPO } from "./links";

  const root = "../";
  const q4 = { slug: "q4", url: "https://docs.example.com/planning/2026/q4-planning", description: "Q4 planning" };
  const noCopy = async () => {};
  const policy = `{ "serverUrl": { "Value": "https://go.example.com" } }`;
</script>

<SiteHeader {root} current="extension" />

<main>
  <section class="hero">
    <div class="s-wrap s-split">
      <div class="intro">
        <span class="s-eyebrow">Browser extension · Chrome · Edge · Firefox</span>
        <h1 class="s-display">Go links, right in your address bar.</h1>
        <p class="s-lede">
          Type <code>go/roadmap</code> and land on the roadmap. Cairn’s extension makes short links
          work in any tab, with no DNS, VPN or hosts-file changes. It works on its own from the
          first minute, and with your company’s server when you have one.
        </p>
        <div class="s-actions">
          <a class="s-btn primary" href={RELEASES}>Download the latest release</a>
          <a class="s-btn" href="#install">How to install</a>
        </div>
        <p class="small s-muted">Free and open source. Chrome 123+, Edge, Firefox 140+.</p>
      </div>
      <div class="hero-art" inert>
        <div class="popup-shadow">
          <ToolbarPopup view={{ kind: "created", link: q4 }} where={{ local: true }} copy={noCopy} />
        </div>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="ways">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">Three ways in</span>
        <h2 class="s-h2" id="ways">Open, find and make links without leaving the page you’re on.</h2>
      </div>

      <div class="rows">
        <div class="s-split row">
          <div class="text">
            <span class="num">01</span>
            <h3 class="s-h2">Type <span class="mono">go/name</span></h3>
            <p class="s-lede">The extension rewrites it to the right address before the browser looks anything up, so it works on any network. Anything after the name passes through: <GoName name="bug/ABC-12" /> opens that ticket.</p>
          </div>
          <div class="art" inert>
            <div class="addr">
              <span class="lock" aria-hidden="true"></span>
              <span class="typed"><span class="muted">go/</span>bug/ABC-12</span>
            </div>
            <div class="arrow-down" aria-hidden="true">↓</div>
            <div class="addr landed">
              <span class="lock" aria-hidden="true"></span>
              <span class="typed">tracker.example.com/browse/<b>ABC-12</b></span>
            </div>
          </div>
        </div>

        <div class="s-split row">
          <div class="text">
            <span class="num">02</span>
            <h3 class="s-h2">Search with <Kbd keys="go" /> <Kbd keys="space" /></h3>
            <p class="s-lede">Can’t remember the exact name? Type <code>go</code>, a space, and the first few letters. Matching links appear as suggestions, with what each one is for.</p>
          </div>
          <div class="art" inert>
            <OmniboxPreview typed="on" suggestions={[
              { slug: "oncall", description: "Who’s on call right now" },
              { slug: "oncall-runbooks", description: "Runbooks for paged alerts" },
              { slug: "onboarding", description: "New starter checklist" },
            ]} />
          </div>
        </div>

        <div class="s-split row">
          <div class="text">
            <span class="num">03</span>
            <h3 class="s-h2">Save the page you’re on</h3>
            <p class="s-lede">Click the toolbar button, pick a name, press <Kbd keys="↵" />. Cairn checks the name is free as you type and suggests a <code>{'{*}'}</code> link when the page ends in an ID.</p>
          </div>
          <div class="art" inert>
            <div class="popup-shadow">
              <ToolbarPopup
                view={{ kind: "new", check: { state: "free" } }} where={{ local: true }}
                slug="q4" url={q4.url} description="Q4 planning" tab={{ url: q4.url, title: "Q4 planning" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="modes">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">Local or shared</span>
        <h2 class="s-h2" id="modes">Works alone. Better with your team.</h2>
        <p class="s-lede">Switch between the two any time, from settings or the toolbar popup. The other side’s links are kept, just not used.</p>
      </div>
      <div class="s-grid two">
        <article class="mode s-card">
          <span class="pill">local</span>
          <h3 class="s-h2">In this browser</h3>
          <p>The default. Links live in this browser profile only: no server, no sign-in, no account. They behave exactly as on a server, <code>{'{*}'}</code> included, and <strong>Manage links</strong> lists, searches, edits and deletes them.</p>
          <ul>
            <li>Nothing leaves your machine</li>
            <li>Ready the moment it’s installed</li>
            <li>Perfect for your own shortcuts</li>
          </ul>
        </article>
        <article class="mode s-card shared">
          <span class="pill">remote</span>
          <h3 class="s-h2">On your company’s server</h3>
          <p>Enter your <a href="../server/">Cairn server’s</a> address and everyone sees the same links. Sign in once with your company account through Cloudflare Access; the popup and search use that sign-in until it expires.</p>
          <ul>
            <li>One set of links for the whole company</li>
            <li>Owners, search and change history on the server</li>
            <li>Set for everyone by browser policy</li>
          </ul>
        </article>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="details">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">The details</span>
        <h2 class="s-h2" id="details">Small things that make it just work.</h2>
      </div>
      <div class="s-grid three">
        <Feature tag="search engines" title="Catches go/ searches">
          Until the browser learns that <code>go</code> is an address, it may send <code>go/name</code> to your search engine. On Google, Bing and DuckDuckGo the extension catches that and opens the link instead.
        </Feature>
        <Feature tag="unknown names" title="A missing link is a prompt">
          Type a name nobody has made yet and you land on a “new link” form with the name filled in.
        </Feature>
        <Feature tag="one source" title="Every browser, same behaviour">
          One codebase, built for Chrome and Edge (Manifest V3 service worker) and Firefox (event page).
        </Feature>
        <Feature tag="permissions" title="Asks for little">
          Only <code>go/</code> and the three search engines up front. Access to your server is requested once, when you choose to use one.
        </Feature>
        <Feature tag="managed" title="Ready for IT">
          Force-install it and set the server for everyone with a managed policy; local mode is then not offered.
        </Feature>
        <Feature tag="MIT" title="Open source">
          Every line is on <a href={REPO}>GitHub</a>. Packages for each browser are attached to every release.
        </Feature>
      </div>
    </div>
  </section>

  <section class="s-section" id="install" aria-labelledby="install-h">
    <div class="s-wrap s-split top">
      <div class="s-section-head sticky">
        <span class="s-eyebrow">Install</span>
        <h2 class="s-h2" id="install-h">Up and running in a minute.</h2>
        <p class="s-lede">Download the package for your browser from the <a href={RELEASES}>latest GitHub release</a>, then load it.</p>
      </div>
      <Steps steps={[{ title: "Chrome or Edge", body: chrome }, { title: "Firefox", body: firefox }, { title: "Type go/ and go", body: go }]} />
    </div>
  </section>

  <section class="s-section" aria-labelledby="rollout">
    <div class="s-wrap s-split top">
      <div class="s-section-head">
        <span class="s-eyebrow">For IT</span>
        <h2 class="s-h2" id="rollout">Roll it out to the whole company.</h2>
        <p class="s-lede">Publish the release packages unlisted or privately on the Chrome Web Store, Edge Add-ons and Firefox Add-ons, then force-install by policy and point everyone at your server.</p>
        <p><a href="{README}">Policy formats for Google Admin, Windows, Linux, Edge and Firefox →</a></p>
      </div>
      <div class="policy">
        <p class="cn-label">Google Admin console · extension policy</p>
        <pre class="s-code">{policy}</pre>
        <p class="cn-label">Firefox · policies.json</p>
        <pre class="s-code">{`{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "cairn@geoffnin.github.io": {
          "serverUrl": "https://go.example.com"
        }
      }
    }
  }
}`}</pre>
      </div>
    </div>
  </section>

  <section class="s-section closing">
    <div class="s-wrap closing-inner">
      <h2 class="s-h2">Your first go link is a minute away.</h2>
      <div class="s-actions">
        <a class="s-btn primary" href={RELEASES}>Download the extension</a>
        <a class="s-btn" href="../server/">Set up a server for your team</a>
      </div>
    </div>
  </section>
</main>

<SiteFooter {root} />

{#snippet chrome()}
  <p>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>), turn on <strong>Developer mode</strong>, choose <strong>Load unpacked</strong> and pick the unzipped <code>…-chrome-edge.zip</code>.</p>
{/snippet}
{#snippet firefox()}
  <p>Open <code>about:debugging#/runtime/this-firefox</code>, choose <strong>Load Temporary Add-on</strong> and pick <code>manifest.json</code> from the unzipped <code>…-firefox.zip</code>. For a lasting install, your company publishes it to Firefox Add-ons.</p>
{/snippet}
{#snippet go()}
  <p>Settings open in <strong>local mode</strong>, so links work straight away. Click the toolbar button to make your first one, then type it in the address bar.</p>
{/snippet}

<style>
  .hero { padding: clamp(40px, 7vw, 96px) 0 clamp(48px, 7vw, 96px); }
  .intro { display: grid; gap: var(--space-5); justify-items: start; }
  .small { font-size: 14px; }
  .hero-art { display: grid; justify-items: center; }
  .popup-shadow {
    width: var(--popup-width); max-width: 100%;
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
    box-shadow: 0 30px 60px -20px rgb(35 33 29 / .25), var(--shadow-menu);
  }
  .hero-art .popup-shadow { transform: rotate(-1.5deg); }

  .rows { display: grid; gap: clamp(56px, 8vw, 96px); }
  .row .text { display: grid; gap: var(--space-3); }
  .num { font: 500 13px/1 var(--font-mono); color: var(--terracotta); }
  .mono { font-family: var(--font-mono); font-weight: 500; letter-spacing: -0.04em; }
  .row :global(.cn-kbd) { font-size: .55em; vertical-align: middle; }
  .s-lede :global(.cn-kbd) { font-size: 13px; }
  .art {
    display: grid; justify-items: center; align-content: center; gap: var(--space-3);
    min-height: 300px; padding: var(--space-6) var(--space-5);
    background: var(--surface-sunken); border-radius: 18px;
  }
  @media (min-width: 920px) { .row:nth-child(even) .text { order: 2; } }

  .addr {
    display: flex; align-items: center; gap: 10px; width: min(440px, 100%); height: 48px; padding: 0 16px;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-full);
    font: 500 15px/1 var(--font-mono); box-shadow: var(--shadow-menu);
    overflow: hidden; white-space: nowrap;
  }
  .addr.landed { font-weight: 400; color: var(--ink-muted); box-shadow: var(--shadow-card); }
  .addr.landed b { color: var(--ink); font-weight: 500; }
  .lock { width: 10px; height: 10px; flex: none; border-radius: 2px; background: var(--line-control); }
  .muted { color: var(--ink-faint); }
  .arrow-down { font: 400 20px/1 var(--font-sans); color: var(--terracotta); }

  .mode { display: grid; gap: var(--space-3); align-content: start; padding: var(--space-6); }
  .mode p { color: var(--ink-muted); }
  .mode.shared { background: var(--moss-soft); border-color: transparent; }
  .pill { justify-self: start; font: var(--type-kbd); padding: 2px 8px; border-radius: var(--radius-full); background: var(--surface-sunken); color: var(--ink-muted); border: 1px solid var(--line); }
  .shared .pill { background: var(--surface); color: var(--moss); }
  ul { margin: var(--space-2) 0 0; padding: 0; list-style: none; display: grid; gap: var(--space-2); }
  li { display: flex; gap: var(--space-2); align-items: baseline; }
  li::before { content: "✓"; color: var(--moss); font-weight: 600; }

  .top { align-items: start; }
  .policy { display: grid; gap: var(--space-2); min-width: 0; }
  .policy .cn-label { margin-top: var(--space-3); }
  @media (min-width: 920px) { .sticky { position: sticky; top: 96px; } }

  .closing { text-align: center; }
  .closing-inner { display: grid; justify-items: center; gap: var(--space-6); }
  .closing .s-actions { justify-content: center; }
</style>
