<!-- What go/name opens when nobody has made it yet: the form to make it, name filled in, and below
     it the links it might have meant, so a long list never pushes the form out of the way. -->
<script lang="ts">
  import type { Link, NewLink } from "../lib/links";
  import GoName from "./GoName.svelte";
  import Header from "./Header.svelte";
  import MakeLinkCard from "./MakeLinkCard.svelte";
  import Page from "./Page.svelte";
  import SimilarLinks from "./SimilarLinks.svelte";

  type Props = {
    host: string;
    slug: string;
    similar: Link[];
    href: (link: Link) => string;
    allLinksHref?: string;
    create: (link: NewLink) => Promise<Link>;
    oncreated?: (link: Link) => void;
  };
  let { host, slug, similar, href, allLinksHref = "#all", create, oncreated }: Props = $props();
  const id = $props.id();
</script>

<Page>
  <Header>
    {#snippet hint()}<code>{host}</code>{/snippet}
    {#snippet end()}<a href={allLinksHref}>All links</a>{/snippet}
  </Header>
  <div class="intro">
    <h1><GoName name={slug} /> isn’t a link yet</h1>
    <p>Make it now, and it works for everyone at your company.</p>
  </div>
  <MakeLinkCard {slug} {create} {oncreated} />
  {#if similar.length}
    <section class="similar" aria-labelledby="{id}-similar">
      <h2 id="{id}-similar">Or did you mean</h2>
      <SimilarLinks links={similar} {href} />
    </section>
  {/if}
</Page>

<style>
  .intro { display: grid; gap: var(--space-2); padding-top: var(--space-6); }
  h1 { font: var(--type-title); letter-spacing: var(--tracking-title); overflow-wrap: anywhere; }
  h1 :global(.go) { font-size: 20px; font-weight: 500; }
  p { color: var(--ink-muted); }
  .similar { display: grid; gap: var(--space-2); }
  h2 { font: var(--type-label); color: var(--ink-muted); }
</style>
