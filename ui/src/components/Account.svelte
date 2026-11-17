<!-- Who is signed in, and the way out: "dev@example.com · Sign out". -->
<script lang="ts">
  let { email, signOutHref }: { email: string; signOutHref?: string } = $props();
</script>

<span class="account">{email}{#if signOutHref}{" · "}<a href={signOutHref}>Sign out</a>{/if}</span>

<style>
  .account { font: var(--type-small); color: var(--ink-muted); }
  a { color: inherit; }
</style>
