<!-- An action that reads as a link: underlined text, no box ("Skip for now", "Undo", "Edit go/bug").
     A button, because it does something here rather than go somewhere; with href it is a link.
     A link cannot be disabled, so a disabled LinkButton is always a (disabled) button. As a link,
     it takes only the attributes a link has; button-only ones are dropped. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes & { href?: string; muted?: boolean; children: Snippet };
  let { href, muted = false, type = "button", disabled, children, ...rest }: Props = $props();
  // What a link can use: everything but the button's own form attributes.
  const linkRest = $derived.by(() => {
    const { form: _f, formaction: _a, formenctype: _e, formmethod: _m, formnovalidate: _n, formtarget: _t, name: _na, value: _v, ...attrs } = rest;
    return attrs as HTMLAnchorAttributes;
  });
</script>

{#if href && !disabled}
  <a class="lb" class:muted {href} {...linkRest}>{@render children()}</a>
{:else}
  <button class="lb" class:muted {type} {disabled} {...rest}>{@render children()}</button>
{/if}

<style>
  .lb {
    padding: 0; border: 0; background: none; cursor: pointer;
    font: inherit; color: var(--moss);
    text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px;
  }
  .lb:hover { color: var(--moss-hover); }
  .lb:disabled { opacity: .5; cursor: default; }
  .muted { color: var(--ink-muted); }
  .muted:hover { color: var(--ink); }
  .lb :global(code) { font-family: var(--font-mono); font-size: .95em; }
</style>
