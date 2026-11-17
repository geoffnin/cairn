<!-- Where a page sits: links back up, then the current page (a go/ name), which is not a link. -->
<script lang="ts">
  import GoName from "./GoName.svelte";

  let { trail, current }: { trail: { label: string; href: string }[]; current: string } = $props();
</script>

<nav aria-label="Breadcrumb">
  <ol>
    {#each trail as step (step.href)}<li><a href={step.href}>{step.label}</a><span class="sep" aria-hidden="true">/</span></li>{/each}
    <li aria-current="page"><GoName name={current} /></li>
  </ol>
</nav>

<style>
  ol { display: flex; flex-wrap: wrap; gap: var(--space-1); margin: 0; padding: 0; list-style: none; font: var(--type-small); color: var(--ink-muted); }
  li { display: inline-flex; gap: var(--space-1); }
  a { color: var(--ink); }
  [aria-current] :global(.go) { font-size: 12px; font-weight: 400; }
</style>
