<!-- The toolbar popup's frame: a heading line with where links live (a Tag) at its end, the
     state's content, and a footer of two links. Always compact, --popup-width wide. -->
<script lang="ts" module>
  export type FooterLink = { label: string; href?: string; onclick?: () => void };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import Tag from "./Tag.svelte";

  type Props = {
    title?: string;
    /** Replaces the title, for a heading that is more than text. */
    head?: Snippet;
    /** "local" in this browser, else the server's host. */
    where?: { local: true } | { server: string };
    links?: FooterLink[];
    children: Snippet;
  };
  let { title, head, where, links = [], children }: Props = $props();
</script>

<div class="popup">
  <div class="head">
    {#if head}{@render head()}{:else if title}<h1>{title}</h1>{/if}
    {#if where}
      {#if "local" in where}<Tag label="local" title="Saved in this browser only" />
      {:else}<Tag label="remote" title="Shared on {where.server}" />{/if}
    {/if}
  </div>
  {@render children()}
  {#if links.length}
    <div class="foot">
      {#each links as l (l.label)}
        <a href={l.href ?? "#"} onclick={l.onclick ? (e) => { e.preventDefault(); l.onclick!(); } : undefined}>{l.label}</a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .popup { display: grid; gap: var(--space-3); width: var(--popup-width); padding: var(--space-4); background: var(--surface); }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 20px; }
  h1 { font: var(--type-heading); }
  .foot { display: flex; justify-content: space-between; padding-top: var(--space-3); margin-top: var(--space-1); border-top: 1px solid var(--line); }
  .foot a { font: var(--type-small); color: var(--ink-muted); }
  .foot a:hover { color: var(--ink); }
</style>
