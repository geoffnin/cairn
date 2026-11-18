<!-- Line icons on a 24px grid, stroked in the current colour. Decorative unless given a label. -->
<script lang="ts" module>
  export type IconName = "search" | "check" | "arrow" | "copy" | "external";
</script>

<script lang="ts">
  let { name, size = 16, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width={size <= 14 ? 2 : 1.5} stroke-linecap="round" stroke-linejoin="round"
  role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}
>
  {#if name === "search"}<circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  {:else if name === "check"}<polyline points="20 6 9 17 4 12" />
  {:else if name === "arrow"}<path d="M5 12h14M13 6l6 6-6 6" />
  {:else if name === "copy"}<rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
  {:else if name === "external"}<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  {/if}
</svg>

<style>
  .icon { display: inline-block; flex: none; vertical-align: middle; }
</style>
