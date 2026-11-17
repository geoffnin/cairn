<!-- A go/ name: mono, with a muted go/ that CSS supplies, so copying it yields the bare name.
     With href it is a link that turns moss on hover. -->
<script lang="ts">
  let { name, href, title }: { name: string; href?: string; title?: string } = $props();
</script>

{#if href}
  <a class="go link" {href} {title}>{name}</a>
{:else}
  <span class="go" {title}>{name}</span>
{/if}

<style>
  /* Mono at 500; size and line height follow the surrounding text. */
  .go { font: var(--type-go-name); font-size: inherit; line-height: inherit; color: inherit; white-space: nowrap; }
  .go::before { content: "go/"; color: var(--ink-muted); font-weight: 400; }
  .link { color: var(--ink); text-decoration: none; }
  .link:hover { color: var(--moss); text-decoration: underline; }
</style>
