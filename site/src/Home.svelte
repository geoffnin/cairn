<script lang="ts">
  import GoName from "@cairn/ui/components/GoName.svelte";
  import Kbd from "@cairn/ui/components/Kbd.svelte";
  import Mark from "@cairn/ui/components/Mark.svelte";
  import Feature from "./parts/Feature.svelte";
  import Flow from "./parts/Flow.svelte";
  import SiteFooter from "./parts/SiteFooter.svelte";
  import SiteHeader from "./parts/SiteHeader.svelte";
  import TypingOmnibox from "./parts/TypingOmnibox.svelte";
  import { REPO } from "./links";

  const root = "./";
  const directory = [
    { slug: "roadmap", owner: "maya@", host: "docs.example.com" },
    { slug: "oncall", owner: "you", host: "pager.example.com" },
    { slug: "bug/{*}", owner: "sam@", host: "tracker.example.com" },
    { slug: "standup", owner: "priya@", host: "meet.example.com" },
  ];
</script>

<SiteHeader {root} />

<main>
  <section class="hero">
    <div class="s-wrap hero-inner">
      <span class="s-eyebrow">Open source go links</span>
      <h1 class="s-display">Type <span class="go">go/roadmap</span>.<br />Land on the roadmap.</h1>
      <p class="s-lede">
        Cairn gives every team a short, memorable name for the pages they live in. A browser
        extension makes <code>go/</code> work in the address bar; a server on Cloudflare shares the
        links with your whole company.
      </p>
      <div class="s-actions">
        <a class="s-btn primary" href="extension/">Get the extension</a>
        <a class="s-btn" href="server/">Deploy the server</a>
      </div>
      <div class="demo"><TypingOmnibox /></div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="pieces">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">Two pieces</span>
        <h2 class="s-h2" id="pieces">Use one on its own, or both together.</h2>
        <p class="s-lede">The extension works with no server at all. Add the server when you want everyone to share the same links.</p>
      </div>

      <div class="s-grid two">
        <a class="product s-card" href="extension/">
          <div class="art ext" aria-hidden="true">
            <div class="chrome">
              <span class="dots"><i></i><i></i><i></i></span>
              <span class="url"><span class="go-muted">go/</span>q4</span>
              <span class="ext-icon"><Mark size={18} /></span>
            </div>
            <div class="popup">
              <span class="ph">New go link <span class="pill">local</span></span>
              <span class="field"><span class="go-muted">go/</span>q4</span>
              <span class="ok">go/q4 is free</span>
              <span class="cta">Create link <Kbd keys="↵" /></span>
            </div>
          </div>
          <div class="copy">
            <span class="label">Browser extension · Chrome, Edge, Firefox</span>
            <h3 class="s-h2">Cairn for your browser</h3>
            <p>Makes <code>go/name</code> open the right page from the address bar, with no DNS or hosts-file changes. Keeps links in your browser, or uses your company’s server.</p>
            <span class="more">Explore the extension →</span>
          </div>
        </a>

        <a class="product s-card" href="server/">
          <div class="art srv" aria-hidden="true">
            <div class="table">
              <div class="th"><span>Name</span><span>Owner</span><span>Goes to</span></div>
              {#each directory as row, i (row.slug)}
                <div class="tr" class:fresh={i === 1}><GoName name={row.slug} /><span>{row.owner}</span><span class="host">{row.host}</span></div>
              {/each}
            </div>
          </div>
          <div class="copy">
            <span class="label">Cloudflare Worker · self-hosted</span>
            <h3 class="s-h2">Cairn server</h3>
            <p>One place where your company creates, searches and shares links. Signs people in with your identity provider through Cloudflare Access. Deploys in one click.</p>
            <span class="more">Explore the server →</span>
          </div>
        </a>
      </div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="how">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">How it works</span>
        <h2 class="s-h2" id="how">From the address bar to the page, before DNS.</h2>
      </div>
      <div style="--n: 4"><Flow stops={[
        { who: "You", what: "go/roadmap", detail: "Typed in the address bar, or go + space to search names as you type." },
        { who: "Extension", what: "rewrite", detail: "Turns it into your server’s address before the browser looks anything up." },
        { who: "Server", what: "sign in + look up", detail: "Cloudflare Access checks who you are; the link comes from memory, KV or D1." },
        { who: "Browser", what: "302 → the page", detail: "You land on docs.example.com/…/roadmap. No cold starts on the way." },
      ]} /></div>
    </div>
  </section>

  <section class="s-section" aria-labelledby="why">
    <div class="s-wrap">
      <div class="s-section-head">
        <span class="s-eyebrow">Why Cairn</span>
        <h2 class="s-h2" id="why">Small, fast and yours.</h2>
      </div>
      <div class="s-grid three">
        <Feature tag="{'{*}'} pass-through" title="Links that take arguments">
          <GoName name="bug/ABC-12" /> opens ticket ABC-12. Put <code>{'{*}'}</code> in a destination and the rest of the name goes there.
        </Feature>
        <Feature tag="no cold starts" title="Fast everywhere">
          Runs on Cloudflare’s network, close to everyone, with redirects cached in memory and KV in front of the database.
        </Feature>
        <Feature tag="$0 to run" title="Built to cost nothing">
          Designed to fit Cloudflare’s free tiers at company scale. No servers to patch, no database to babysit.
        </Feature>
        <Feature tag="no secrets" title="Nothing to leak">
          Cairn holds no passwords, client secrets or signing keys. Sign-in is Cloudflare Access with your identity provider.
        </Feature>
        <Feature tag="privacy" title="People are random IDs">
          Usage events never contain an email address or the full destination, so your metrics platform never learns who clicked what.
        </Feature>
        <Feature tag="MIT" title="Open source">
          Read every line, run it in your own account, and change it. Your copy is yours; pull new versions when you want them.
        </Feature>
      </div>
    </div>
  </section>

  <section class="s-section closing">
    <div class="s-wrap closing-inner">
      <h2 class="s-h2">Start with the extension today. Bring the team when you’re ready.</h2>
      <div class="s-actions">
        <a class="s-btn primary" href="extension/">Get the extension</a>
        <a class="s-btn" href="server/">Deploy the server</a>
        <a class="s-btn" href={REPO}>View on GitHub</a>
      </div>
    </div>
  </section>
</main>

<SiteFooter {root} />

<style>
  .hero { padding: clamp(48px, 9vw, 112px) 0 clamp(40px, 6vw, 72px); overflow: hidden; }
  .hero-inner { display: grid; justify-items: center; text-align: center; gap: var(--space-5); }
  .hero .s-lede { margin: 0 auto; }
  .hero .s-actions { justify-content: center; }
  .go { font-family: var(--font-mono); font-weight: 500; letter-spacing: -0.06em; color: var(--moss); white-space: nowrap; }
  .demo { width: 100%; margin-top: var(--space-6); text-align: left; }

  .product { display: grid; grid-template-rows: auto 1fr; overflow: hidden; color: inherit; text-decoration: none; transition: border-color 160ms var(--ease-quick), transform 160ms var(--ease-settle); }
  .product:hover { border-color: var(--line-control); transform: translateY(-2px); }
  .product:hover .more { text-decoration: underline; }
  .copy { display: grid; gap: var(--space-3); align-content: start; padding: var(--space-6); }
  .copy p { color: var(--ink-muted); }
  .label { font: 500 12px/16px var(--font-mono); color: var(--ink-faint); }
  .more { color: var(--moss); font-weight: 500; margin-top: var(--space-2); text-underline-offset: 3px; }

  .art { position: relative; height: 240px; background: var(--surface-sunken); border-bottom: 1px solid var(--line); overflow: hidden; }
  .go-muted { color: var(--ink-faint); }

  .chrome {
    position: absolute; left: 24px; right: 24px; top: 28px; height: 44px;
    display: flex; align-items: center; gap: 12px; padding: 0 12px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
  }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); }
  .url { flex: 1; padding: 4px 12px; border-radius: var(--radius-full); background: var(--surface-sunken); font: 500 14px/20px var(--font-mono); }
  .ext-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--radius-md); background: var(--moss-soft); }
  .popup {
    position: absolute; right: 24px; top: 86px; width: min(250px, 70%);
    display: grid; gap: 8px; padding: 14px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; box-shadow: var(--shadow-menu);
    font-size: 13px;
  }
  .ph { display: flex; justify-content: space-between; font-weight: 600; }
  .pill { font: var(--type-kbd); padding: 1px 6px; border-radius: var(--radius-full); background: var(--moss-soft); color: var(--moss); }
  .field { padding: 5px 9px; border: 1px solid var(--line-control); border-radius: var(--radius-md); background: var(--field); font: 500 13px/18px var(--font-mono); }
  .ok { font-size: 12px; color: var(--moss); }
  .cta { justify-self: start; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: var(--radius-md); background: var(--moss); color: var(--on-moss); font-weight: 500; }

  .table {
    position: absolute; left: 24px; right: -40px; top: 28px;
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 13px;
  }
  .th, .tr { display: grid; grid-template-columns: 1.1fr .7fr 1.4fr; gap: 12px; align-items: center; padding: 0 16px; }
  .th { height: 32px; font: var(--type-label); color: var(--ink-muted); background: var(--surface-sunken); border-bottom: 1px solid var(--line); }
  .tr { height: 42px; border-bottom: 1px solid var(--line); color: var(--ink-muted); }
  .tr :global(.go) { color: var(--ink); }
  .tr.fresh { box-shadow: inset 3px 0 var(--terracotta); background: var(--terracotta-soft); }
  .host { font: var(--type-url); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .closing { text-align: center; }
  .closing-inner { display: grid; justify-items: center; gap: var(--space-6); }
  .closing .s-actions { justify-content: center; }
</style>
