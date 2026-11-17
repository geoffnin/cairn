<!-- What go/name opens when nobody has made it yet: the links it might have meant, and the form to
     make it, name filled in. -->
<script lang="ts">
  import type { Link, NewLink, UsedLink } from "../lib/links";
  import GoName from "./GoName.svelte";
  import Header from "./Header.svelte";
  import MakeLinkCard from "./MakeLinkCard.svelte";
  import Page from "./Page.svelte";
  import SimilarLinks from "./SimilarLinks.svelte";

  type Props = {
    host: string;
    slug: string;
    similar: UsedLink[];
    tries?: number;
    href: (link: UsedLink) => string;
    allLinksHref?: string;
    create: (link: NewLink) => Promise<Link>;
    oncreated?: (link: Link) => void;
  };
  let { host, slug, similar, tries, href, allLinksHref = "#all", create, oncreated }: Props = $props();
</script>

<Page>
  <Header>
    {#snippet hint()}<code>{host}</code>{/snippet}
    {#snippet end()}<a href={allLinksHref}>All links</a>{/snippet}
  </Header>
  <div class="intro">
    <h1><GoName name={slug} /> isn’t a link yet</h1>
    <p>{similar.length ? "Did you mean one of these? Or make it now" : "Make it now"}, and it works for everyone at your company.</p>
  </div>
  {#if similar.length}<SimilarLinks links={similar} {href} />{/if}
  <MakeLinkCard {slug} {tries} {create} {oncreated} />
</Page>

<style>
  .intro { display: grid; gap: var(--space-2); padding-top: var(--space-6); }
  h1 { font: var(--type-title); letter-spacing: var(--tracking-title); overflow-wrap: anywhere; }
  h1 :global(.go) { font-size: 20px; font-weight: 500; }
  p { color: var(--ink-muted); }
</style>
