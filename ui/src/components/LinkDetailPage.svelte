<!-- One link's page on the server: what it is and does, and every change to it. (Usage, from
     Prometheus, is a later step: UsageCard is ready for it.) -->
<script lang="ts">
  import type { Link } from "../lib/links";
  import type { LinkChange } from "../lib/usage";
  import Account from "./Account.svelte";
  import Breadcrumb from "./Breadcrumb.svelte";
  import ChangeHistory from "./ChangeHistory.svelte";
  import Header from "./Header.svelte";
  import LinkSummary from "./LinkSummary.svelte";
  import Page from "./Page.svelte";

  type Props = {
    host: string;
    me: string;
    link: Link & { created: string; changed?: string };
    changes: LinkChange[];
    /** Who created it, as History shows it. Not the owner, which can change hands. */
    createdBy?: string;
    now?: Date;
    allLinksHref?: string;
    copy?: (text: string) => Promise<void>;
    onedit?: (link: Link) => void;
    ondelete?: (link: Link) => void;
  };
  let {
    host, me, link, changes, createdBy, now, allLinksHref = "#all",
    copy, onedit, ondelete,
  }: Props = $props();
</script>

<Page>
  <Header>
    {#snippet hint()}<code>{host}</code>{/snippet}
    {#snippet end()}<Account email={me} />{/snippet}
  </Header>
  <Breadcrumb trail={[{ label: "All links", href: allLinksHref }]} current={link.slug} />
  <LinkSummary {link} {now} {copy} {onedit} {ondelete} />
  <ChangeHistory {changes} created={{ date: link.created, by: createdBy }} {now} />
</Page>
