<!-- An action that reads as a link: underlined text, no box ("Skip for now", "Undo", "Edit go/bug").
     A button, because it does something here rather than go somewhere; with href it is a link. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes & { href?: string; muted?: boolean; children: Snippet };
  let { href, muted = false, type = "button", children, ...rest }: Props = $props();
</script>

{#if href}
  <a class="lb" class:muted {href}>{@render children()}</a>
{:else}
  <button class="lb" class:muted {type} {...rest}>{@render children()}</button>
{/if}

<style>
  .lb {
    padding: 0; border: 0; background: none; cursor: pointer;
    font: inherit; color: var(--moss);
    text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px;
  }
  .lb:hover { color: var(--moss-hover); }
  .muted { color: var(--ink-muted); }
  .muted:hover { color: var(--ink); }
  .lb :global(code) { font-family: var(--font-mono); font-size: .95em; }
</style>
