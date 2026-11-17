<!-- The line under a Name field while it is typed: "✓ go/q4 is free", or "Checking…". A taken
     name gets a NameTaken notice instead, so this shows nothing for it. -->
<script lang="ts">
  import type { NameCheck } from "../lib/links";
  import GoName from "./GoName.svelte";
  import Icon from "./Icon.svelte";

  let { slug, check }: { slug: string; check: NameCheck | null } = $props();
</script>

{#if slug && check?.state === "free"}
  <span class="note free"><Icon name="check" size={12} /><span><GoName name={slug} /> is free</span></span>
{:else if slug && check?.state === "checking"}
  <span class="note">Checking…</span>
{/if}

<style>
  .note { display: inline-flex; align-items: center; gap: var(--space-1); font: var(--type-small); color: var(--ink-muted); }
  .free :global(svg) { color: var(--moss); }
  .note :global(.go) { font-size: 12px; font-weight: 400; color: var(--ink-muted); }
  .note :global(.go)::before { color: inherit; }
</style>
