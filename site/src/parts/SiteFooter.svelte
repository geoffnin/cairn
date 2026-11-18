<!-- The site's foot: the topographic contours from the design system, the products again, and
     where the source lives. -->
<script lang="ts">
  import Mark from "@cairn/ui/components/Mark.svelte";
  import { DECISIONS, LICENSE, README, REPO } from "../links";

  let { root }: { root: string } = $props();
</script>

<footer>
  <div class="s-wrap inner">
    <div class="about">
      <a class="brand" href={root}><Mark size={22} /><span>cairn</span></a>
      <p class="s-muted">Go links for your company. Open source, MIT licensed, built on Cloudflare.</p>
    </div>
    <nav aria-label="Footer">
      <div>
        <h2>Product</h2>
        <a href="{root}extension/">Browser extension</a>
        <a href="{root}server/">Server</a>
      </div>
      <div>
        <h2>Developers</h2>
        <a href={README}>Documentation</a>
        <a href={DECISIONS}>Design decisions</a>
        <a href="{root}storybook/">Component library</a>
      </div>
      <div>
        <h2>Project</h2>
        <a href={REPO}>GitHub</a>
        <a href="{REPO}/releases">Releases</a>
        <a href={LICENSE}>MIT licence</a>
      </div>
    </nav>
  </div>
</footer>

<style>
  footer {
    position: relative; isolation: isolate; overflow: hidden;
    padding: 64px 0 180px; border-top: 1px solid var(--line);
  }
  footer::after {
    content: ""; position: absolute; inset: auto 0 0; height: 240px; z-index: -1; pointer-events: none;
    background: var(--topo-line);
    mask:
      url("../../../ui/src/styles/topo.svg") bottom / 100% 100% no-repeat,
      linear-gradient(to top, #000, rgb(0 0 0 / .55) 40%, transparent);
    mask-composite: intersect;
  }
  .inner { display: flex; flex-wrap: wrap; gap: 48px; justify-content: space-between; }
  .about { display: grid; gap: var(--space-3); max-width: 300px; align-content: start; }
  .brand {
    display: inline-flex; align-items: center; gap: var(--space-2); text-decoration: none;
    font: 600 20px/1 var(--font-sans); letter-spacing: -0.03em; color: var(--ink);
  }
  .about p { font-size: 14px; line-height: 1.55; }
  nav { display: flex; flex-wrap: wrap; gap: 48px; }
  nav div { display: grid; gap: 10px; align-content: start; }
  h2 { font: var(--type-label); color: var(--ink-faint); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  nav a { font-size: 14px; color: var(--ink-muted); text-decoration: none; }
  nav a:hover { color: var(--moss); text-decoration: underline; }
</style>
