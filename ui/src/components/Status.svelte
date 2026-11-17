<!-- One line of feedback, past tense, naming the link: "Created go/wiki." go/ names in the text
     are set in the go-name style. Errors are clay and announced as alerts. -->
<script lang="ts">
  import { goNameSegments, type Message } from "../lib/links";
  import GoName from "./GoName.svelte";

  let { message }: { message: Message | null } = $props();
</script>

<p class="status" class:error={message?.error} role={message?.error ? "alert" : "status"}>
  {#if message}
    {#each goNameSegments(message.text) as part, i (i)}
      {#if "name" in part}<GoName name={part.name} />{:else}{part.text}{/if}
    {/each}
  {/if}
</p>

<style>
  .status { font: var(--type-body); color: var(--ink-muted); overflow-wrap: anywhere; }
  .status:empty { display: none; }
  .status :global(.go) { color: var(--ink); }
  .error, .error :global(.go) { color: var(--clay); }
</style>
