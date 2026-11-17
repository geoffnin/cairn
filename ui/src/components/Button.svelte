<!-- Variants: default, primary (one per view), quiet, danger. `small` for row actions.
     With href it renders a link that looks like a button. Height follows density. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes &
    Pick<HTMLAnchorAttributes, "href" | "target" | "rel"> & {
      variant?: "default" | "primary" | "quiet" | "danger";
      small?: boolean;
      children: Snippet;
    };
  let { variant = "default", small = false, href, type = "button", children, ...rest }: Props = $props();
</script>

{#if href}
  <a class="btn {variant}" class:small {href} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else}
  <button class="btn {variant}" class:small {type} {...rest}>{@render children()}</button>
{/if}

<style>
  .btn {
    display: inline-flex; align-items: center; gap: var(--space-2);
    height: var(--control); padding: 0 var(--space-3);
    font-weight: 500; white-space: nowrap; text-decoration: none;
    color: var(--ink); background: var(--surface);
    border: 1px solid var(--line-control); border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 120ms var(--ease-quick), border-color 120ms var(--ease-quick);
  }
  .btn:hover { background: var(--surface-sunken); }
  .btn:active { transform: translateY(1px); }
  .primary { background: var(--moss); border-color: var(--moss); color: var(--on-moss); }
  .primary:hover { background: var(--moss-hover); border-color: var(--moss-hover); }
  .quiet { background: transparent; border-color: transparent; color: var(--ink-muted); }
  .quiet:hover { background: var(--surface-sunken); color: var(--ink); }
  .danger { background: transparent; border-color: transparent; color: var(--clay); }
  .danger:hover { background: var(--clay-soft); }
  .small { height: 24px; padding: 0 var(--space-2); font-size: 12px; }
  .btn:disabled { opacity: .5; cursor: default; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .btn:active { transform: none; }
  }
</style>
