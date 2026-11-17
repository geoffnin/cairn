<!-- The manage page, shared by the extension (links in this browser) and the server UI (a shared
     server): header, New link card, and the links card with search and the table. Everything
     specific to where links live comes from the LinkSource. -->
<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import type { Link, LinkSource, Message } from "../lib/links";
  import Card from "./Card.svelte";
  import Checkbox from "./Checkbox.svelte";
  import EditDialog from "./EditDialog.svelte";
  import GoName from "./GoName.svelte";
  import Header from "./Header.svelte";
  import LinkForm from "./LinkForm.svelte";
  import LinkTable from "./LinkTable.svelte";
  import Page from "./Page.svelte";
  import Search from "./Search.svelte";
  import Status from "./Status.svelte";

  let { source, account }: { source: LinkSource; account?: Snippet } = $props();

  let links = $state<Link[]>([]);
  let loaded = $state(false); // the first load has answered
  let q = $state("");
  let mine = $state(false);
  let listMessage = $state<Message | null>(null);
  let editing = $state<Link | null>(null);

  // The link just created or edited: its row settles in with the terracotta marker. Kept for the
  // length of the fade, since a change elsewhere can re-render the list right after a save.
  let fresh = $state<string | null>(null);
  let freshTimer: ReturnType<typeof setTimeout>;
  function markFresh(slug: string) {
    fresh = slug;
    clearTimeout(freshTimer);
    freshTimer = setTimeout(() => (fresh = null), 2000);
  }

  let seq = 0;
  async function load() {
    const id = ++seq;
    try {
      const found = await source.list({ q: q.trim(), mine });
      if (id !== seq) return; // a newer load finished first
      links = found;
      loaded = true;
      if (listMessage?.error) listMessage = null; // the list is right again

    } catch (err) {
      if (id === seq) listMessage = { text: (err as Error).message, error: true };
    }
  }
  let searchTimer: ReturnType<typeof setTimeout>;
  function search() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 150);
  }

  async function remove(link: Link) {
    if (!confirm(source.confirmDelete(link))) return;
    try {
      await source.remove(link);
      listMessage = { text: `Deleted go/${link.slug}.` };
      load();
    } catch (err) {
      listMessage = { text: (err as Error).message, error: true };
    }
  }

  // An unknown name (go/x that does not exist yet) lands here as ?new=x. The extension's popup
  // hands over a link it could not save itself the same way, with ?url= and ?desc=.
  const params = new URLSearchParams(location.search);
  const unknownName = params.get("new") ?? "";
  let slug = $state(unknownName);
  let url = $state(params.get("url") ?? "");
  let description = $state(params.get("desc") ?? "");
  let formMessage = $state<Message | null>(
    unknownName ? { text: `go/${unknownName} does not exist yet. Add a destination to create it.` } : null,
  );
  let urlInput: HTMLInputElement | undefined = $state();

  onMount(() => {
    if (unknownName) urlInput?.focus();
    load();
    return source.watch?.(load);
  });
</script>

<Page>
  <Header end={account}>
    {#snippet hint()}Type <GoName name="name" /> in the address bar.{/snippet}
  </Header>

  <LinkForm
    create={(l) => source.create(l)}
    bind:slug bind:url bind:description bind:message={formMessage} bind:urlInput
    oncreated={(link) => {
      history.replaceState(null, "", location.pathname);
      markFresh(link.slug);
      load();
    }}
  />

  <Card>
    <div class="tools">
      <Search label="Search names, URLs and descriptions" bind:value={q} oninput={search} />
      {#if source.shared}<Checkbox label="Only mine" bind:checked={mine} onchange={load} />{/if}
    </div>
    <LinkTable
      {links} href={(l) => source.href(l)} shared={source.shared} {fresh} loading={!loaded}
      query={q.trim()} filtered={mine}
      onedit={(l) => (editing = l)} ondelete={remove}
    />
    <Status message={listMessage} />
  </Card>
</Page>

<EditDialog
  bind:link={editing} shared={source.shared}
  save={(l, changes) => source.update(l, changes)}
  onsaved={(l) => {
    listMessage = { text: `Saved go/${l.slug}.` };
    markFresh(l.slug);
    load();
  }}
/>

<style>
  .tools { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }
</style>
