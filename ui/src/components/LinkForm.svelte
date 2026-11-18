<!-- The New link card: name and destination side by side (stacked below 560px), description
     below, the {*} hint, then Create and its status on one line. Beside the name, a mark says
     whether it is free (`check`, which the parent keeps for `slug`); a taken name says so under the
     field and is not sent. -->
<script lang="ts">
  import type { Link, Message, NameCheck, NewLink } from "../lib/links";
  import Button from "./Button.svelte";
  import Card from "./Card.svelte";
  import NameCheckMark from "./NameCheckMark.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    create: (link: NewLink) => Promise<Link>;
    slug?: string;
    url?: string;
    description?: string;
    message?: Message | null;
    check?: NameCheck | null;
    urlInput?: HTMLInputElement;
    oncreated?: (link: Link) => void;
  };
  let {
    create, slug = $bindable(""), url = $bindable(""), description = $bindable(""),
    message = $bindable(null), check = null, urlInput = $bindable(), oncreated,
  }: Props = $props();
  let slugInput: HTMLInputElement | undefined = $state();
  let busy = $state(false);
  const taken = $derived(check?.state === "taken" ? `go/${slug.trim().toLowerCase()} already exists.` : undefined);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return; // a second Enter while the first create is still on its way
    if (taken) return slugInput?.focus();
    busy = true;
    const sent = { slug, url, description };
    try {
      const link = await create(sent);
      message = { text: `Created go/${link.slug}.` };
      // Clear what was sent, but keep anything typed while it was being saved.
      if (slug === sent.slug) slug = "";
      if (url === sent.url) url = "";
      if (description === sent.description) description = "";
      slugInput?.focus();
      oncreated?.(link);
    } catch (err) {
      message = { text: (err as Error).message, error: true };
    } finally {
      busy = false;
    }
  }
</script>

<Card title="New link">
  <form onsubmit={submit}>
    <div class="grid">
      <TextField label="Name" go bind:value={slug} bind:input={slugInput} required maxlength={64} autocomplete="off" spellcheck={false} placeholder="roadmap" error={taken}>
        {#snippet trail()}<NameCheckMark {slug} {check} />{/snippet}
      </TextField>
      <TextField label="Destination URL" mono bind:value={url} bind:input={urlInput} required maxlength={2048} autocomplete="off" spellcheck={false} placeholder="https://docs.example.com/roadmap" />
      <TextField label="Description (optional)" class="wide" bind:value={description} maxlength={500} autocomplete="off" />
    </div>
    <p class="cn-hint">
      Use <code>{"{*}"}</code> to pass text through: <code>https://tracker.example.com/browse/{"{*}"}</code>
      makes <code>go/bug/ABC-12</code> open that ticket.
    </p>
    <div class="foot">
      <Button variant="primary" type="submit" disabled={busy}>Create link</Button>
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
