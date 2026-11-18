<script lang="ts">
  import LinksPage from "@cairn/ui/components/LinksPage.svelte";
  import { api, serverLinks, type Me } from "./api";

  let me = $state<Me | null>(null);
  api<Me>("GET", "/me").then((m) => (me = m), () => {});
</script>

<LinksPage source={serverLinks}>
  {#snippet account()}
    {#if me}{me.email}{me.isAdmin ? " (admin)" : ""}{/if}
  {/snippet}
</LinksPage>
