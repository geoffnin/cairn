<!-- Makes a link that someone just tried: the name is filled in, so the destination is where to
     start. Creating it opens it, since that is where the person was going. `tries` says how many
     people wanted the name. -->
<script lang="ts">
  import type { Link, Message, NewLink } from "../lib/links";
  import Button from "./Button.svelte";
  import Card from "./Card.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    slug: string;
    tries?: number;
    create: (link: NewLink) => Promise<Link>;
    oncreated?: (link: Link) => void;
  };
  let { slug: initial, tries = 0, create, oncreated }: Props = $props();
  let slug = $state("");
  let url = $state("");
  let description = $state("");
  let message = $state<Message | null>(null);
  let busy = $state(false);
  let urlInput: HTMLInputElement | undefined = $state();
  $effect.pre(() => {
    slug = initial;
  });
  $effect(() => {
    urlInput?.focus();
  });

  const note = $derived(
    `You’ll be the owner.${tries > 0 ? ` ${tries} ${tries === 1 ? "person" : "people"} tried this name this month.` : ""}`,
  );

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    try {
      oncreated?.(await create({ slug: slug.trim(), url: url.trim(), description: description.trim() }));
    } catch (err) {
      message = { text: (err as Error).message, error: true };
    } finally {
      busy = false;
    }
  }
</script>

<Card title="Make go/{initial}">
  <form onsubmit={submit}>
    <div class="grid">
      <TextField label="Name" go bind:value={slug} required maxlength={64} autocomplete="off" spellcheck={false} />
      <TextField label="Destination" mono bind:value={url} bind:input={urlInput} required maxlength={2048} autocomplete="off" spellcheck={false} placeholder="https://pager.example.com/schedules/sre" />
      <TextField label="Description" note="(optional, helps people find it)" class="wide" bind:value={description} maxlength={500} autocomplete="off" />
    </div>
    <Status {message} />
    <div class="foot">
      <Button variant="primary" type="submit" disabled={busy}>Create link and open it</Button>
      <span class="cn-hint">{note}</span>
    </div>
  </form>
</Card>

<style>
  form { display: grid; gap: var(--space-3); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-3); }
  .grid > :global(.wide) { grid-column: 1 / -1; }
  @media (max-width: 560px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-1); }
</style>
