<!-- The Cairn mark: seven flat faces in the brand colours, fixed across themes. -->
<script lang="ts">
  let { size = 22 }: { size?: number } = $props();
</script>

<svg class="mark" viewBox="0 0 560 540" width={size} aria-hidden="true">
  <polygon class="peach" points="363,5 180,88 75,268 298,145" />
  <polygon class="umber" points="363,5 505,235 298,145" />
  <polygon class="sage-light" points="298,145 505,235 205,407" />
  <polygon class="sage" points="75,268 298,145 205,407 48,475 8,437" />
  <polygon class="terracotta" points="505,235 552,403 448,526 405,292" />
  <polygon class="pine" points="205,407 405,292 448,526" />
  <polygon class="forest" points="48,475 205,407 448,526 95,530" />
</svg>

<style>
  .mark { display: block; height: auto; flex: none; stroke-linejoin: round; stroke-width: 2; }
  .peach { fill: var(--brand-peach); stroke: var(--brand-peach); }
  .umber { fill: var(--brand-umber); stroke: var(--brand-umber); }
  .sage-light { fill: var(--brand-sage-light); stroke: var(--brand-sage-light); }
  .sage { fill: var(--brand-sage); stroke: var(--brand-sage); }
  .terracotta { fill: var(--brand-terracotta); stroke: var(--brand-terracotta); }
  .pine { fill: var(--brand-pine); stroke: var(--brand-pine); }
  .forest { fill: var(--brand-forest); stroke: var(--brand-forest); }
</style>
