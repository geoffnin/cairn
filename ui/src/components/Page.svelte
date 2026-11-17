<!-- A full page: one column centred at --page-max, ending in the topographic footer, faint
     contour lines strongest at the bottom edge and gone about 240px up. The lines are topo.svg
     used as a mask over --topo-line, so they follow the theme. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { narrow = false, children }: { narrow?: boolean; children: Snippet } = $props();
</script>

<main class:narrow>{@render children()}</main>

<style>
  main {
    position: relative; isolation: isolate;
    display: grid; align-content: start; gap: var(--space-5);
    min-height: 100vh; padding: var(--space-6) var(--space-6) 200px;
  }
  main > :global(*) { width: 100%; max-width: var(--page-max); justify-self: center; }
  .narrow { --page-max: 620px; }
  @media (max-width: 560px) { main { padding-inline: var(--space-4); } }

  main::after {
    content: ""; position: absolute; inset: auto 0 0; height: 240px; z-index: -1; pointer-events: none;
    background: var(--topo-line);
    mask:
      url("../styles/topo.svg") bottom / 100% 100% no-repeat,
      linear-gradient(to top, #000, rgb(0 0 0 / .55) 40%, transparent);
    mask-composite: intersect;
  }
</style>
