<!-- One link's page on the server: what it is and does, how much it is used, and every change to
     it. The chart and History point at each other: a change looked at in one is lit in both. -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import type { DailyUses, LinkChange } from "../lib/usage";
  import Account from "./Account.svelte";
  import Breadcrumb from "./Breadcrumb.svelte";
  import ChangeHistory from "./ChangeHistory.svelte";
  import Header from "./Header.svelte";
  import LinkSummary from "./LinkSummary.svelte";
  import Page from "./Page.svelte";
  import UsageCard from "./UsageCard.svelte";

  type Props = {
    host: string;
    me: string;
    link: Link & { created: string; changed?: string; lastUsed?: string };
    uses: DailyUses[];
    changes: LinkChange[];
    /** Who created it, as History shows it. Not the owner, which can change hands. */
    createdBy?: string;
    source?: string;
    now?: Date;
    allLinksHref?: string;
    copy?: (text: string) => Promise<void>;
    onedit?: (link: Link) => void;
    ondelete?: (link: Link) => void;
  };
  let {
    host, me, link, uses, changes, createdBy, source, now, allLinksHref = "#all",
    copy, onedit, ondelete,
  }: Props = $props();
  let active = $state<number | null>(null);
</script>

<Page>
  <Header>
    {#snippet hint()}<code>{host}</code>{/snippet}
    {#snippet end()}<Account email={me} />{/snippet}
  </Header>
  <Breadcrumb trail={[{ label: "All links", href: allLinksHref }]} current={link.slug} />
  <LinkSummary {link} {now} {copy} {onedit} {ondelete} />
  <UsageCard days={uses} {changes} {source} bind:active />
  <ChangeHistory {changes} created={{ date: link.created, by: createdBy }} {now} bind:active />
</Page>
