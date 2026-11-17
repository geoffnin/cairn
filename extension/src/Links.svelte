<script lang="ts">
  import LinksPage from "@cairn/ui/components/LinksPage.svelte";
  import { localLinks } from "./localLinks";
</script>

<LinksPage source={localLinks}>
  {#snippet account()}Links in this browser · <a href="options.html">Settings</a>{/snippet}
</LinksPage>
