<!-- Who is signed in: "dev@example.com". The identity provider signs people in, so there is no
     way out here: the account is the company one. -->
<script lang="ts">
  let { email }: { email: string } = $props();
</script>

<span class="account">{email}</span>

<style>
  .account { font: var(--type-small); color: var(--ink-muted); }
</style>
