<!-- The popup's form for a new link: name (with a mark beside it: free or taken), destination (the tab's
     address), description, Create. A taken name shows what it opens and the ways on instead of
     creating. When the destination ends in an ID, it offers to make that ID {*}, and then says what
     the link will do. The parent checks names (`onslugchange`, then `check`). -->
<script lang="ts">
  import type { Link, NameCheck, NewLink } from "../lib/links";
  import { passThroughExamples, PASS_THROUGH, suggestPassThrough } from "../lib/passthrough";
  import Button from "./Button.svelte";
  import GoName from "./GoName.svelte";
  import Kbd from "./Kbd.svelte";
  import LinkButton from "./LinkButton.svelte";
  import NameCheckMark from "./NameCheckMark.svelte";
  import NameTaken from "./NameTaken.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";
  import type { Message } from "../lib/links";

  type Props = {
    slug?: string;
    url?: string;
    description?: string;
    check?: NameCheck | null;
    /** The tab's title, offered as the description. */
    title?: string;
    /** A heading above the form, when it is not the popup's only content. */
    heading?: string;
    message?: Message | null;
    busy?: boolean;
    autofocus?: boolean;
    onslugchange?: (slug: string) => void;
    oncreate: (link: NewLink) => void;
    onedittaken?: (link: Link) => void;
  };
  let {
    slug = $bindable(""), url = $bindable(""), description = $bindable(""), check = null, title = "",
    heading, message = null, busy = false, autofocus = true, onslugchange, oncreate, onedittaken,
  }: Props = $props();
  const id = $props.id();
  let slugInput: HTMLInputElement | undefined = $state();
  /** The ID that was turned into {*}, to explain the result. */
  let token = $state("");

  const taken = $derived(check?.state === "taken" ? check : null);
  const suggestion = $derived(suggestPassThrough(url));
  const examples = $derived(token && slug && url.includes(PASS_THROUGH) ? passThroughExamples(slug, url, token) : null);

  $effect(() => {
    if (autofocus) slugInput?.focus();
  });

  function passThrough() {
    if (!suggestion) return;
    token = suggestion.token;
    url = suggestion.template;
  }
  function useName(name: string) {
    slug = name;
    onslugchange?.(name);
    slugInput?.focus();
  }
  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    if (taken) return slugInput?.focus();
    oncreate({ slug: slug.trim(), url: url.trim(), description: description.trim() || title });
  }
</script>

<form onsubmit={submit} aria-labelledby={heading ? `${id}-h` : undefined}>
  {#if heading}<h2 id="{id}-h">{heading}</h2>{/if}
  <TextField
    label="Name" go bind:value={slug} bind:input={slugInput} required maxlength={64} autocomplete="off" spellcheck={false}
    oninput={() => onslugchange?.(slug)} invalid={Boolean(taken)} describedby={taken ? `${id}-taken` : undefined}
  >
    {#snippet trail()}<NameCheckMark {slug} {check} />{/snippet}
  </TextField>
  {#if taken}<NameTaken id="{id}-taken" link={taken.link} alternative={taken.alternative} onedit={onedittaken} onuse={useName} />{/if}
  <TextField label="Destination" note="· this tab" mono bind:value={url} required maxlength={2048} spellcheck={false}>
    {#snippet action()}
      {#if suggestion}<LinkButton onclick={passThrough}>Make <code>{suggestion.token}</code> a <code>{PASS_THROUGH}</code></LinkButton>{/if}
    {/snippet}
    {#snippet help()}
      {#if examples}<GoName name={examples.mine} /> opens this page; <GoName name={examples.other} /> opens {examples.otherDest}.{/if}
    {/snippet}
  </TextField>
  <TextField label="Description" bind:value={description} maxlength={500} placeholder={title} />
  <Status {message} />
  <div class="actions">
    <Button variant="primary" type="submit" disabled={busy}>Create link</Button>
    {#if !taken}<Kbd keys="Enter" />{/if}
  </div>
</form>

<style>
  form { display: grid; gap: var(--space-3); }
  h2 { font: var(--type-label); color: var(--ink); font-weight: 600; }
  .actions { display: flex; align-items: center; gap: var(--space-2); }
  form :global(.cn-hint .go) { font-size: 12px; color: var(--ink); }
</style>
