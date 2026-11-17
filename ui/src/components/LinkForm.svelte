<!-- The New link card: name and destination side by side (stacked below 560px), description
     below, the {*} hint, then Create and its status on one line. -->
<script lang="ts">
  import type { Link, Message, NewLink } from "../lib/links";
  import Button from "./Button.svelte";
  import Card from "./Card.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    create: (link: NewLink) => Promise<Link>;
    slug?: string;
    url?: string;
    message?: Message | null;
    urlInput?: HTMLInputElement;
    oncreated?: (link: Link) => void;
  };
  let { create, slug = $bindable(""), url = $bindable(""), message = $bindable(null), urlInput = $bindable(), oncreated }: Props = $props();
  let description = $state("");
  let slugInput: HTMLInputElement | undefined = $state();

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    try {
      const link = await create({ slug, url, description });
      message = { text: `Created go/${link.slug}.` };
      slug = url = description = "";
      slugInput?.focus();
      oncreated?.(link);
    } catch (err) {
      message = { text: (err as Error).message, error: true };
    }
  }
</script>

<Card title="New link">
  <form onsubmit={submit}>
    <div class="grid">
      <TextField label="Name" go bind:value={slug} bind:input={slugInput} required maxlength={64} autocomplete="off" spellcheck={false} placeholder="roadmap" />
      <TextField label="Destination URL" mono bind:value={url} bind:input={urlInput} required maxlength={2048} autocomplete="off" spellcheck={false} placeholder="https://docs.example.com/roadmap" />
      <TextField label="Description (optional)" class="wide" bind:value={description} maxlength={500} autocomplete="off" />
    </div>
    <p class="cn-hint">
      Use <code>{"{*}"}</code> to pass text through: <code>https://tracker.example.com/browse/{"{*}"}</code>
      makes <code>go/bug/ABC-12</code> open that ticket.
    </p>
    <div class="foot">
      <Button variant="primary" type="submit">Create link</Button>
      <Status {message} />
    </div>
  </form>
</Card>

<style>
  form { display: grid; gap: var(--space-3); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); gap: var(--space-3); }
  .grid > :global(.wide) { grid-column: 1 / -1; }
  @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-4); margin-top: var(--space-1); }
</style>
