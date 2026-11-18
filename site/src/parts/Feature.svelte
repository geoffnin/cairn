<!-- One feature: a short mono tag, a heading and a sentence or two. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { tag, title, children }: { tag: string; title: string; children: Snippet } = $props();
</script>

<article>
  <span class="tag">{tag}</span>
  <h3 class="s-h3">{title}</h3>
  <p>{@render children()}</p>
</article>

<style>
  article { display: grid; gap: var(--space-2); align-content: start; padding-top: var(--space-4); border-top: 2px solid var(--ink); }
  .tag { font: 500 12px/16px var(--font-mono); color: var(--moss); margin-bottom: var(--space-1); }
  p { color: var(--ink-muted); font-size: 15px; line-height: 1.6; }
</style>
