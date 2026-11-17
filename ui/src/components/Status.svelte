<!-- One line of feedback, past tense, naming the link: "Created go/wiki." go/ names in the text
     are set in the go-name style. Errors are clay.

     Two live regions, polite and assertive, stay mounted even when empty, so screen readers
     announce what is put in them; the empty one is hidden visually only. -->
<script lang="ts">
  import { goNameSegments, type Message } from "../lib/links";
  import GoName from "./GoName.svelte";

  let { message }: { message: Message | null } = $props();
  const info = $derived(message && !message.error ? message : null);
  const error = $derived(message?.error ? message : null);
</script>

{#snippet text(m: Message)}
  {#each goNameSegments(m.text) as part, i (i)}
    {#if "name" in part}<GoName name={part.name} />{:else}{part.text}{/if}
  {/each}
{/snippet}

<p class="status" class:empty={!info} role="status">{#if info}{@render text(info)}{/if}</p>
<p class="status error" class:empty={!error} role="alert">{#if error}{@render text(error)}{/if}</p>

<style>
  .status { font: var(--type-body); color: var(--ink-muted); overflow-wrap: anywhere; }
  .status :global(.go) { color: var(--ink); }
  .error, .error :global(.go) { color: var(--clay); }
  .empty {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
</style>
