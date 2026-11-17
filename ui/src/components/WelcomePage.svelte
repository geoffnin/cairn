<!-- The tab that opens when Cairn is installed: what go links are, a picture of using one, then
     three steps. Where links live is already chosen (this browser), so step 1 starts done and
     step 2, the first link, is where to look. Making it (or skipping) moves on to step 3. -->
<script lang="ts">
  import type { Link, NewLink } from "../lib/links";
  import FirstLinkForm from "./FirstLinkForm.svelte";
  import GoName from "./GoName.svelte";
  import Header from "./Header.svelte";
  import LinkButton from "./LinkButton.svelte";
  import OmniboxPreview from "./OmniboxPreview.svelte";
  import Page from "./Page.svelte";
  import Step from "./Step.svelte";
  import TryIt from "./TryIt.svelte";
  import WhereLinksLive from "./WhereLinksLive.svelte";

  type Props = {
    mode?: "local" | "shared";
    create: (link: NewLink) => Promise<Link>;
    onmodechange?: (mode: "local" | "shared") => void;
    onimport?: () => void;
    settingsHref?: string;
    linksHref?: string;
  };
  let { mode = $bindable("local"), create, onmodechange, onimport, settingsHref = "#settings", linksHref = "#links" }: Props = $props();
  let made = $state<Link | null>(null);
  let skipped = $state(false);
  const firstDone = $derived(Boolean(made) || skipped);
</script>

<Page>
  <Header>
    {#snippet end()}<a href={settingsHref}>Settings</a>{/snippet}
  </Header>

  <section class="hero">
    <h1>Cairn is installed</h1>
    <p>
      Short links you type in the address bar. <GoName name="roadmap" /> opens the roadmap; <GoName name="bug/ABC-12" />
      opens that ticket. Three things and you’re set.
    </p>
    <OmniboxPreview typed="road" suggestions={[{ slug: "roadmap", description: "Product roadmap, 2027" }, { slug: "roadmap-archive", description: "Older plans" }]} />
  </section>

  <Step n={1} title="Where your links live" state="done">
    {#snippet aside()}Change any time in Settings{/snippet}
    <WhereLinksLive bind:mode onchange={onmodechange} />
  </Step>

  <Step n={2} title="Make your first link" state={firstDone ? "done" : "current"}>
    {#snippet aside()}{#if !firstDone}<LinkButton muted onclick={() => (skipped = true)}>Skip for now</LinkButton>{/if}{/snippet}
    <FirstLinkForm {create} {onimport} oncreated={(l) => (made = l)} />
  </Step>

  <Step n={3} title="Try it" state={firstDone ? "current" : "todo"}>
    <TryIt example={made?.slug ?? "roadmap"} />
  </Step>

  <p class="end">That’s everything. <a href={linksHref}>See your links</a></p>
</Page>

<style>
  .hero { display: grid; gap: var(--space-4); padding-block: var(--space-6) var(--space-2); }
  h1 { font: var(--type-title); letter-spacing: var(--tracking-title); }
  .hero p { max-width: 560px; color: var(--ink-muted); }
  .hero p :global(.go) { color: var(--ink); }
  .end { text-align: center; color: var(--ink-muted); padding-top: var(--space-4); }
</style>
