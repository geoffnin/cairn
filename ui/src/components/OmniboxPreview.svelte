<!-- A picture of Chrome's address bar suggesting links as go/ is typed. Decorative: it shows
     what will happen, it does nothing, so it is hidden from assistive tech. -->
<script lang="ts">
  import GoName from "./GoName.svelte";
  import Icon from "./Icon.svelte";

  type Props = { typed: string; suggestions: { slug: string; description: string }[]; active?: number };
  let { typed, suggestions, active = 0 }: Props = $props();
</script>

<div class="omnibox" aria-hidden="true">
  <div class="bar"><Icon name="search" /><GoName name={typed} /><span class="caret"></span></div>
  {#each suggestions as s, i (s.slug)}
    <div class="row" class:active={i === active}><GoName name={s.slug} /><span class="desc">{s.description}</span></div>
  {/each}
</div>

<style>
  .omnibox {
    width: min(560px, 100%); overflow: hidden;
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-menu);
  }
  .bar { display: flex; align-items: center; gap: var(--space-2); height: 40px; padding: 0 var(--space-3); color: var(--ink-muted); border-bottom: 1px solid var(--line); }
  .bar :global(.go) { color: var(--ink); font-weight: 400; }
  .caret { width: 1px; height: 16px; margin-left: 2px; background: var(--ink); animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .caret { animation: none; } }
  .row { display: flex; align-items: baseline; gap: var(--space-3); padding: var(--space-2) var(--space-4); }
  .row :global(.go) { color: var(--moss); }
  .active { background: var(--surface-sunken); }
  .desc { color: var(--ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
