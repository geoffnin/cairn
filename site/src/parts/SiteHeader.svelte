<!-- The site's top bar: the mark and wordmark home, then the two products and GitHub.
     `root` is the relative path back to the home page ("./" or "../"). -->
<script lang="ts">
  import Mark from "@cairn/ui/components/Mark.svelte";
  import { REPO } from "../links";

  let { root, current }: { root: string; current?: "extension" | "server" } = $props();
</script>

<header class="bar">
  <div class="s-wrap inner">
    <a class="brand" href={root} aria-label="Cairn home"><Mark size={26} /><span>cairn</span></a>
    <nav aria-label="Site">
      <a href="{root}extension/" aria-current={current === "extension" ? "page" : undefined}>Extension</a>
      <a href="{root}server/" aria-current={current === "server" ? "page" : undefined}>Server</a>
      <a href={REPO}>GitHub</a>
    </nav>
  </div>
</header>

<style>
  .bar {
    position: sticky; top: 0; z-index: 10;
    background: color-mix(in srgb, var(--page) 86%, transparent);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  }
  .inner { display: flex; align-items: center; gap: var(--space-4); height: 64px; }
  .brand {
    display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
    font: 600 22px/1 var(--font-sans); letter-spacing: -0.03em; color: var(--ink);
  }
  nav { display: flex; gap: 2px; margin-left: auto; }
  nav a {
    padding: 8px 12px; border-radius: var(--radius-md);
    font: 500 15px/20px var(--font-sans); color: var(--ink-muted); text-decoration: none;
  }
  nav a:hover { color: var(--ink); background: var(--surface-sunken); }
  nav a[aria-current="page"] { color: var(--ink); background: var(--moss-soft); }
  @media (max-width: 420px) {
    .brand span { display: none; }
    nav a { padding: 8px 10px; }
  }
</style>
