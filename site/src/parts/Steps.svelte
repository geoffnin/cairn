<!-- A numbered list of steps, each a heading and a body. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { steps }: { steps: { title: string; body: Snippet }[] } = $props();
</script>

<ol>
  {#each steps as step, i (step.title)}
    <li>
      <span class="n" aria-hidden="true">{i + 1}</span>
      <div>
        <h3 class="s-h3">{step.title}</h3>
        <div class="body">{@render step.body()}</div>
      </div>
    </li>
  {/each}
</ol>

<style>
  ol { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-5); }
  li { display: grid; grid-template-columns: 36px 1fr; gap: var(--space-4); }
  .n {
    display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--radius-full);
    font: 600 14px/1 var(--font-mono); color: var(--on-moss); background: var(--moss);
  }
  h3 { margin-top: 6px; }
  .body { margin-top: var(--space-2); color: var(--ink-muted); font-size: 15px; line-height: 1.6; display: grid; gap: var(--space-3); min-width: 0; }
</style>
