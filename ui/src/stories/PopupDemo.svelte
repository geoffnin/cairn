<!-- Stories only: the toolbar popup wired to links in memory, so the whole journey can be clicked
     through and tested: type a name, see whether it is free, create, copy, undo. -->
<script lang="ts">
  import ToolbarPopup, { type PopupView } from "../components/ToolbarPopup.svelte";
  import type { Link, NameCheck, NewLink } from "../lib/links";
  import { untrack } from "svelte";

  type Props = { links: Link[]; tab: { url: string; title: string }; copy?: (text: string) => Promise<void> };
  let { links: initial, tab, copy = async () => {} }: Props = $props();
  const links = $state(new Map<string, Link>());
  $effect.pre(() => {
    for (const l of initial) links.set(l.slug, l);
  });

  let slug = $state("");
  let url = $state(untrack(() => tab.url)); // the tab when the popup opened
  let description = $state("");
  let check = $state<NameCheck | null>(null);
  let created = $state<Link | null>(null);

  function nameCheck(name: string): NameCheck | null {
    const n = name.trim().toLowerCase();
    if (!n) return null;
    const link = links.get(n);
    if (!link) return { state: "free" };
    const host = /^https?:\/\/([^./]+)/.exec(tab.url)?.[1] ?? "new";
    let alternative = `${n}-${host}`;
    for (let i = 2; links.has(alternative); i++) alternative = `${n}-${host}-${i}`;
    return { state: "taken", link, alternative };
  }

  const view = $derived<PopupView>(created ? { kind: "created", link: created } : { kind: "new", check });

  function create(l: NewLink) {
    const link = { ...l, slug: l.slug.toLowerCase() };
    links.set(link.slug, link);
    created = link;
  }
  function undo(link: Link) {
    links.delete(link.slug);
    created = null;
    slug = link.slug;
    url = link.url;
    description = link.description;
    check = nameCheck(slug);
  }
</script>

<ToolbarPopup
  {view} where={{ local: true }} {tab} {copy} bind:slug bind:url bind:description
  onslugchange={(s) => (check = nameCheck(s))} oncreate={create} onundo={undo} onedit={() => {}}
/>
