<!-- The toolbar popup: make a link for the current tab in seconds. Always compact. -->
<script lang="ts">
  import Button from "@cairn/ui/components/Button.svelte";
  import SelectField from "@cairn/ui/components/SelectField.svelte";
  import Status from "@cairn/ui/components/Status.svelte";
  import TextField from "@cairn/ui/components/TextField.svelte";
  import type { Link, Message } from "@cairn/ui/lib/links";
  import { onMount } from "svelte";
  import { api, backendId, getState, hasServerAccess, setMode } from "../config.js";
  import { ext } from "../ext.js";
  import { createLink } from "../local.js";

  type State = Awaited<ReturnType<typeof getState>>;
  type Backend = State["active"];
  type Server = NonNullable<State["server"]>;

  // Read before anything renders, so an early click is never lost.
  let loaded: Promise<State> = getState();
  let current = $state<State | null>(null);
  let backend = $state("");
  let slug = $state("");
  let url = $state("");
  let description = $state("");
  let message = $state<Message | null>(null);
  let busy = $state(false);
  let slugInput: HTMLInputElement | undefined = $state();

  function show(s: State) {
    current = s;
    backend = backendId(s.active);
  }
  // A choice only makes sense once there is more than one place to save to.
  const where = $derived(
    !current || current.choices.length > 1 ? "" : current.active.kind === "local" ? "Saved in this browser" : `Saved to ${current.active.label}`,
  );

  function openTab(target: string) {
    ext.tabs.create({ url: target });
    window.close();
  }
  const allLinksUrl = (b: Backend) => (b.kind === "local" ? ext.runtime.getURL("links.html") : `${b.url}/_/`);
  // The server's own form does the same job; used when the API cannot be called from here
  // (no host access granted, or the person needs to sign in to Cloudflare Access first).
  function continueOnSite(b: Server) {
    const draft = new URLSearchParams({ new: slug.trim(), url: url.trim() });
    if (description.trim()) draft.set("desc", description.trim());
    openTab(`${b.url}/_/?${draft}`);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const { active } = await loaded;
    if (active.kind === "server" && !(await hasServerAccess(active))) return continueOnSite(active);
    busy = true;
    message = null;
    const sent = { slug, url, description };
    try {
      const link: Link = active.kind === "local" ? await createLink(sent) : await api(active, "POST", "/links", sent);
      const copied = await navigator.clipboard.writeText(`go/${link.slug}`).then(() => true, () => false);
      message = { text: copied ? `Created go/${link.slug} and copied it to the clipboard.` : `Created go/${link.slug}.` };
      // Clear what was sent, but keep anything typed while it was being saved.
      if (slug === sent.slug) slug = "";
      if (url === sent.url) url = "";
      if (description === sent.description) description = "";
    } catch (err) {
      // Signed out of Access: the website can take over, and loading it signs the person in.
      if (active.kind === "server" && (err as { status?: number }).status === 401) return continueOnSite(active);
      message = { text: (err as Error).message, error: true };
    } finally {
      busy = false;
    }
  }

  async function changeBackend() {
    // Submit waits on `loaded`, so it must include the switch, not only the reload after it.
    loaded = setMode(backend).then(() => getState());
    show(await loaded);
  }

  onMount(() => {
    slugInput?.focus();
    loaded.then(show);
    ext.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.url && /^https?:/.test(tab.url) && !url) url = tab.url;
    });
  });
</script>

<div class="popup">
  <div class="head">
    <h1>New go link</h1>
    <span class="cn-hint">{where}</span>
  </div>
  <form onsubmit={submit}>
    {#if current && current.choices.length > 1}
      <SelectField
        label="Use links from" bind:value={backend} onchange={changeBackend}
        options={current.choices.map((b) => ({ value: backendId(b), label: b.label }))}
      />
    {/if}
    <TextField label="Name" go bind:value={slug} bind:input={slugInput} required maxlength={64} autocomplete="off" spellcheck={false} />
    <TextField label="Destination URL" mono bind:value={url} required maxlength={2048} spellcheck={false} />
    <TextField label="Description (optional)" bind:value={description} maxlength={500} />
    <Status {message} />
    <div class="foot">
      <Button variant="primary" type="submit" disabled={busy}>Create link</Button>
      <a href={ext.runtime.getURL("links.html")} onclick={async (e) => { e.preventDefault(); openTab(allLinksUrl((await loaded).active)); }}>All links</a>
    </div>
  </form>
</div>

<style>
  .popup { width: var(--popup-width); padding: var(--space-4); background: var(--surface); }
  :global(body) { background: var(--surface); }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3); }
  h1 { font: var(--type-heading); }
  form { display: grid; gap: var(--space-3); }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-1); }
  .foot a { font: var(--type-small); }
</style>
