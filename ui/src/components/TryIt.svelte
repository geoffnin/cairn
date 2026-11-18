<!-- Welcome step 3: three ways to use Cairn, side by side: open a link, search links, save the
     page you are on. `example` is a link to try, ideally the one just made. -->
<script lang="ts">
  import GoName from "./GoName.svelte";
  import Kbd from "./Kbd.svelte";
  import Tip from "./Tip.svelte";

  let { example = "roadmap" }: { example?: string } = $props();
</script>

<div class="tips">
  <Tip title="Open a link">
    {#snippet demo()}<span class="chip"><GoName name={example} /></span>{/snippet}
    In a new tab’s address bar. If Chrome searches instead, type the trailing slash once: <code>go/</code>
  </Tip>
  <Tip title="Search your links">
    {#snippet demo()}<Kbd keys={["go", "Space"]} /><code class="typed">{example.slice(0, 4)}…</code>{/snippet}
    Suggestions show the name and its description.
  </Tip>
  <Tip title="Save the page you’re on">
    {#snippet demo()}<span class="pin">Pin Cairn to the toolbar</span>{/snippet}
    Open Chrome’s extensions menu and pin Cairn. One click makes a link to any page.
  </Tip>
</div>

<style>
  .tips { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-5); }
  .chip { padding: 2px var(--space-2); background: var(--surface-sunken); border-radius: var(--radius-sm); }
  .chip :global(.go) { font-size: 12px; }
  .typed { font-size: 12px; color: var(--ink-muted); margin-left: var(--space-1); }
  .pin { font: var(--type-body); color: var(--ink); }
</style>
