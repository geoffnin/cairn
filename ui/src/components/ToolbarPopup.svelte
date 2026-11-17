<!-- The toolbar popup, in each of its states:
     new        A page with no link yet (A), or one whose name is taken (C), by `check`.
     linked     This page already has a link (B): it, and a form for another.
     created    Just created (D): the link large, Copy, Undo and Edit.
     signed-out A shared server that needs signing in to (E).
     Presentational: the extension does the work in the callbacks. -->
<script lang="ts" module>
  import type { Link, Message, NameCheck, NewLink } from "../lib/links";

  export type PopupView =
    | { kind: "new"; check?: NameCheck | null; message?: Message | null }
    | { kind: "linked"; existing: Link[]; check?: NameCheck | null; message?: Message | null }
    | { kind: "created"; link: Link }
    | { kind: "signed-out"; server: string };
</script>

<script lang="ts">
  import CopyButton from "./CopyButton.svelte";
  import CreatedLink from "./CreatedLink.svelte";
  import ExistingLinks from "./ExistingLinks.svelte";
  import GoName from "./GoName.svelte";
  import Button from "./Button.svelte";
  import LinkButton from "./LinkButton.svelte";
  import PopupFrame, { type FooterLink } from "./PopupFrame.svelte";
  import PopupLinkForm from "./PopupLinkForm.svelte";

  type Props = {
    view: PopupView;
    where: { local: true } | { server: string };
    /** The current tab. */
    tab?: { url: string; title: string };
    slug?: string;
    url?: string;
    description?: string;
    busy?: boolean;
    allLinksHref?: string;
    settingsHref?: string;
    copy?: (text: string) => Promise<void>;
    onslugchange?: (slug: string) => void;
    oncreate?: (link: NewLink) => void;
    onedit?: (link: Link) => void;
    onundo?: (link: Link) => void;
    onsignin?: () => void;
    onchangeserver?: () => void;
  };
  let {
    view, where, tab = { url: "", title: "" }, slug = $bindable(""), url = $bindable(tab.url), description = $bindable(""),
    busy = false, allLinksHref = "#all", settingsHref = "#settings", copy, onslugchange, oncreate = () => {}, onedit, onundo, onsignin, onchangeserver,
  }: Props = $props();

  const links = $derived<FooterLink[]>(
    view.kind === "signed-out"
      ? [{ label: "Use a different server", onclick: onchangeserver, href: settingsHref }, { label: "Settings", href: settingsHref }]
      : [{ label: "All links", href: allLinksHref }, { label: "Settings", href: settingsHref }],
  );
  const shareUrl = (l: Link) => `http://go/${l.slug}`;
</script>

{#if view.kind === "created"}
  {@const link = view.link}
  <PopupFrame {links}>
    {#snippet head()}
      <p class="done" role="status"><span class="dot" aria-hidden="true"></span><span>Created <GoName name={link.slug} />.</span></p>
      {#if onundo}<LinkButton onclick={() => onundo(link)}>Undo</LinkButton>{/if}
    {/snippet}
    <CreatedLink {link} />
    <div class="row">
      <CopyButton variant="primary" label="Copy link" keys="⌘C" text={shareUrl(link)} {copy} />
      {#if onedit}<LinkButton onclick={() => onedit(link)}>Edit</LinkButton>{/if}
    </div>
    <p class="cn-hint">Copies <code>{shareUrl(link)}</code>, which works in chat and docs for anyone with Cairn.</p>
  </PopupFrame>
{:else if view.kind === "signed-out"}
  <PopupFrame title="New go link" {where} {links}>
    <p class="lead">Sign in to see your company’s links and make new ones.</p>
    <div class="signin">
      <Button variant="primary" onclick={onsignin}>Sign in</Button>
      <p class="cn-hint">Opens {view.server} in a new tab. Come back here when you’re done.</p>
    </div>
  </PopupFrame>
{:else if view.kind === "linked"}
  <PopupFrame title="This page is" {where} {links}>
    <ExistingLinks links={view.existing} {copy} />
    <hr />
    <PopupLinkForm
      heading="Add another link" bind:slug bind:url bind:description title={tab.title} check={view.check} message={view.message}
      {busy} autofocus={false} {onslugchange} {oncreate} onedittaken={onedit}
    />
  </PopupFrame>
{:else}
  <PopupFrame title="New go link" {where} {links}>
    <PopupLinkForm
      bind:slug bind:url bind:description title={tab.title} check={view.check} message={view.message}
      {busy} {onslugchange} {oncreate} onedittaken={onedit}
    />
  </PopupFrame>
{/if}

<style>
  .done { display: inline-flex; align-items: center; gap: var(--space-2); font: var(--type-body); }
  .dot { width: 8px; height: 8px; border-radius: var(--radius-full); background: var(--terracotta); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .lead { font: var(--type-body); }
  .signin { display: grid; justify-items: start; gap: var(--space-2); }
  hr { width: 100%; margin: var(--space-1) 0; border: 0; border-top: 1px solid var(--line); }
</style>
