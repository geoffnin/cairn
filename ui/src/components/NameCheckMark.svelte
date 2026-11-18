<!-- Beside a Name field, whether the name can be had: a grey ring while the field is empty (so
     nothing moves when typing starts), a spinner while it is checked, a moss check when it is
     free, a clay mark when it is taken. Screen readers hear "go/q4 is free" or "already exists". -->
<script lang="ts">
  import type { NameCheck } from "../lib/links";

  let { slug, check }: { slug: string; check: NameCheck | null } = $props();
  const name = $derived(slug.trim().toLowerCase());
  const state = $derived(name && check ? check.state : "idle");
  const said = $derived(state === "free" ? `go/${name} is free` : state === "taken" ? `go/${name} already exists` : "");
</script>

<span class="mark {state}" aria-hidden="true">
  <svg viewBox="0 0 16 16" width="16" height="16">
    <circle cx="8" cy="8" r="6.75" />
    {#if state === "checking"}<path class="arc" d="M8 1.25a6.75 6.75 0 0 1 6.75 6.75" />
    {:else if state === "free"}<path d="m5.25 8.25 1.75 1.75 3.75-4" />
    {:else if state === "taken"}<path d="M8 4.75v3.75M8 11.25v.01" />{/if}
  </svg>
</span>
<!-- Always mounted, so the result is heard as it arrives while the field has focus. -->
<span class="cn-visually-hidden" role="status">{said}</span>

<style>
  .mark { display: inline-flex; flex: none; color: var(--line-control); }
  svg { display: block; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .checking .arc { stroke: var(--ink-muted); transform-origin: 8px 8px; animation: spin 800ms linear infinite; }
  .free { color: var(--moss); }
  .taken { color: var(--clay); }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .checking .arc { animation-duration: 2400ms; }
  }
</style>
