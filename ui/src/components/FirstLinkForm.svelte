<!-- Welcome step 2: make one link. Name and destination side by side, the {*} tip, Create (Enter
     works too), and a way in for people moving from another go/ links tool. -->
<script lang="ts">
  import type { Link, Message, NewLink } from "../lib/links";
  import Button from "./Button.svelte";
  import GoName from "./GoName.svelte";
  import Kbd from "./Kbd.svelte";
  import LinkButton from "./LinkButton.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    create: (link: NewLink) => Promise<Link>;
    oncreated?: (link: Link) => void;
    onimport?: () => void;
  };
  let { create, oncreated, onimport }: Props = $props();
  let slug = $state("");
  let url = $state("");
  let message = $state<Message | null>(null);
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      const link = await create({ slug: slug.trim(), url: url.trim(), description: "" });
      message = { text: `Created go/${link.slug}. Try it below.` };
      oncreated?.(link);
    } catch (err) {
      message = { text: (err as Error).message, error: true };
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit}>
  <div class="grid">
    <TextField label="Name" go bind:value={slug} required maxlength={64} autocomplete="off" spellcheck={false} placeholder="roadmap" />
    <TextField label="Destination" mono bind:value={url} required maxlength={2048} autocomplete="off" spellcheck={false} placeholder="https://docs.example.com/roadmap" />
  </div>
  <p class="cn-hint">
    Tip: put <code>{"{*}"}</code> in the destination to pass text through, so <GoName name="bug/ABC-12" /> opens ticket ABC-12.
  </p>
  <Status {message} />
  <div class="foot">
    <Button variant="primary" type="submit" disabled={busy}>Create link</Button>
    <span class="cn-hint">or press <Kbd keys="Enter" /></span>
    {#if onimport}<span class="import"><LinkButton onclick={onimport}>Coming from another go/ links tool? Import</LinkButton></span>{/if}
  </div>
</form>

<style>
  form { display: grid; gap: var(--space-3); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: var(--space-3); }
  @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .cn-hint :global(.go) { font-size: 12px; color: var(--ink); }
  .foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
  .import { margin-left: auto; font: var(--type-small); }
</style>
