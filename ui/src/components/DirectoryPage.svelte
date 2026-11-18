<!-- The server's home: everyone's links, searchable, with how much each is used. Presentational:
     the app searches, filters and sorts (`oninput`, `onfilter`, `onsort`) and passes the rows. -->
<script lang="ts">
  import type { DirectoryLink } from "../lib/links";
  import Account from "./Account.svelte";
  import DirectoryTable from "./DirectoryTable.svelte";
  import DirectoryToolbar, { type Filter, type Sort } from "./DirectoryToolbar.svelte";
  import Header from "./Header.svelte";
  import Page from "./Page.svelte";

  type Props = {
    host: string;
    me: string;
    links: DirectoryLink[];
    counts: Record<Filter, number>;
    q?: string;
    filter?: Filter;
    sort?: Sort;
    selected?: number;
    fresh?: string | null;
    now?: Date;
    href: (link: DirectoryLink) => string;
    oninput?: () => void;
    onfilter?: (filter: Filter) => void;
    onsort?: (sort: Sort) => void;
    onnew?: () => void;
    onopen?: (link: DirectoryLink) => void;
    oncopy?: (link: DirectoryLink) => void;
    onedit?: (link: DirectoryLink) => void;
  };
  let {
    host, me, links, counts, q = $bindable(""), filter = $bindable("all"), sort = $bindable("used"), selected = $bindable(-1),
    fresh = null, now, href, oninput, onfilter, onsort, onnew, onopen, oncopy, onedit,
  }: Props = $props();
  const total = $derived(filter === "mine" ? counts.mine : filter === "new" ? counts.new : counts.all);
</script>

<Page>
  <Header>
    {#snippet hint()}<code>{host}</code>{/snippet}
    {#snippet end()}<Account email={me} />{/snippet}
  </Header>
  <DirectoryToolbar bind:q bind:filter bind:sort {counts} {oninput} {onfilter} {onsort} {onnew} />
  <DirectoryTable {links} {total} {href} {me} {now} {fresh} bind:selected query={q.trim()} {onopen} {oncopy} {onedit} />
</Page>
