<!-- Edits one link's destination and description (and owner, on a shared server). Open while
     `link` is set; closing clears it. -->
<script lang="ts">
  import type { Link, LinkChanges } from "../lib/links";
  import Button from "./Button.svelte";
  import GoName from "./GoName.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    link: Link | null;
    shared?: boolean;
    save: (link: Link, changes: LinkChanges) => Promise<void>;
    onsaved?: (link: Link) => void;
  };
  let { link = $bindable(), shared = false, save, onsaved }: Props = $props();
  let dialog: HTMLDialogElement;
  let url = $state("");
  let description = $state("");
  let owner = $state("");
  let error = $state<string | null>(null);
  let saving = $state(false);

  $effect(() => {
    if (link && !dialog.open) {
      url = link.url;
      description = link.description;
      owner = link.owner ?? "";
      error = null;
      dialog.showModal();
    } else if (!link && dialog.open) {
      dialog.close();
    }
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    // The link this save is for. The person may cancel, or open another link, before it ends.
    const submitted = link;
    if (!submitted || saving) return;
    saving = true;
    try {
      await save(submitted, shared ? { url, description, owner } : { url, description });
      if (link === submitted) link = null;
      onsaved?.(submitted);
    } catch (err) {
      if (link === submitted) error = (err as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<dialog bind:this={dialog} onclose={() => (link = null)}>
  <form onsubmit={submit}>
    {#if link}<h2>Edit <GoName name={link.slug} /></h2>{/if}
    <TextField label="Destination URL" mono bind:value={url} required maxlength={2048} spellcheck={false} />
    <TextField label="Description" bind:value={description} maxlength={500} />
    {#if shared}<TextField label="Owner" type="email" bind:value={owner} required maxlength={254} />{/if}
    <Status message={error ? { text: error, error: true } : null} />
    <div class="foot">
      <Button variant="quiet" onclick={() => (link = null)}>Cancel</Button>
      <Button variant="primary" type="submit" disabled={saving}>Save</Button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    width: min(480px, calc(100vw - 32px)); padding: var(--space-5);
    color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-menu);
  }
  dialog[open] { animation: cn-rise 180ms var(--ease-settle); }
  dialog::backdrop { background: rgb(21 23 20 / .32); }
  form { display: grid; gap: var(--space-3); }
  h2 { font: var(--type-heading); }
  .foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
  @media (prefers-reduced-motion: reduce) {
    dialog[open] { animation-name: cn-fade-in; }
  }
</style>
