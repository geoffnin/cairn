<!-- Settings: where links live (this browser or a shared server), and display. -->
<script lang="ts">
  import Button from "@cairn/ui/components/Button.svelte";
  import GoName from "@cairn/ui/components/GoName.svelte";
  import Header from "@cairn/ui/components/Header.svelte";
  import ModeOption from "@cairn/ui/components/ModeOption.svelte";
  import Page from "@cairn/ui/components/Page.svelte";
  import Segmented from "@cairn/ui/components/Segmented.svelte";
  import Status from "@cairn/ui/components/Status.svelte";
  import ServerSetup from "@cairn/ui/components/ServerSetup.svelte";
  import type { Message } from "@cairn/ui/lib/links";
  import { onMount } from "svelte";
  import { LOCAL, SHARED, getState, hasServerAccess, serverAuthenticationUrl, probe, setMode, setServer } from "../config.js";
  import { countLinks } from "../local.js";
  import { applyDisplay, onDisplayChange, readDisplay, saveDisplay, type Density, type Theme } from "./display";

  type State = Awaited<ReturnType<typeof getState>>;
  type Server = NonNullable<State["server"]>;
  type ServerStatus = { text: string; warn?: boolean };

  let current = $state<State | null>(null); // as last shown, so clicks can respond without waiting
  let mode = $state(LOCAL);
  let wantsShared = false;
  let count = $state(0);
  let status = $state<ServerStatus | null>(null);
  let serverUrl = $state("");
  let message = $state<Message | null>(null);
  const say = (text: string, error = false) => (message = { text, error });

  // Must run straight from a click: Chrome only shows the permission prompt for a user gesture.
  const requestAccess = (url: string) => chrome.permissions.request({ origins: [`${url}/*`] }).catch(() => false);

  async function authenticateServer(url: string) {
    if (!(await requestAccess(url))) throw new Error(`Cairn needs permission to reach ${new URL(url).host} to use it.`);
    await chrome.tabs.create({ url: serverAuthenticationUrl(url) });
    say(`Sign in to ${new URL(url).host} in the tab that just opened. This page updates when you come back.`);
  }

  async function sharedStatus(srv: Server): Promise<ServerStatus> {
    if (!(await hasServerAccess(srv))) return { text: "Needs permission to reach this server.", warn: true };
    const p = await probe(srv);
    if (p.email) {
      // Back from the sign-in tab: replace the "sign in" prompt with the outcome.
      if (message?.text.startsWith(`Sign in to ${srv.label}`)) say(`Signed in to ${srv.label} as ${p.email}.`);
      return { text: `Signed in as ${p.email}.` };
    }
    if (p.signedOut) return { text: "Not signed in (or the server is not reachable).", warn: true };
    return { text: p.error, warn: true };
  }

  let renderSeq = 0;
  async function render() {
    const seq = ++renderSeq;
    const state = await getState();
    const n = state.managed ? 0 : await countLinks();
    if (seq !== renderSeq) return; // a newer render finished first
    // Show what is saved straight away; asking the server how it is can take a while.
    if (current?.server?.url !== state.server?.url) status = null;
    current = state;
    mode = state.mode;
    count = n;
    serverUrl = state.server?.url ?? "";
    const s = state.server ? await sharedStatus(state.server) : null;
    if (seq === renderSeq) status = s;
  }

  function chooseShared() {
    wantsShared = true;
    if (current?.server) return void setMode(SHARED).then(render);
    // Nothing to switch to yet: keep local mode until a server is saved.
    mode = LOCAL;
    say("Enter your company's Cairn server address. It saves automatically; choose Authenticate to sign in.");
  }

  async function saveServer(url: string) {
    if (current?.managed) return;
    await setServer(url, false);
    if (wantsShared) await setMode(SHARED);
    void render();
  }

  // Theme and density take effect at once, on every extension page.
  let display = $state(readDisplay());
  const changeDisplay = () => saveDisplay($state.snapshot(display));

  onMount(() => {
    const listener = () => render();
    chrome.storage.onChanged.addListener(listener);
    // Coming back from the sign-in tab: show the new state.
    window.addEventListener("focus", listener);
    const stopDisplay = onDisplayChange((d) => {
      display = d;
      applyDisplay(d);
    });
    render();
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      window.removeEventListener("focus", listener);
      stopDisplay();
    };
  });
</script>

<Page narrow>
  <Header>{#snippet hint()}Settings{/snippet}</Header>

  <p class="cn-hint">
    {current?.managed ? "Your organization set up shared links for this browser." : "Choose where your go/ links live."}
  </p>

  <fieldset>
    <legend>Use links from</legend>
    {#if !current?.managed}
      <ModeOption name="mode" value={LOCAL} bind:group={mode} title="This browser" onselect={() => { wantsShared = false; void setMode(LOCAL).then(render); }}>
        {#snippet body()}Stored only in this Chrome profile, not shared or synced · {count} link{count === 1 ? "" : "s"}{/snippet}
        {#snippet extra()}
          <Button onclick={() => chrome.tabs.create({ url: chrome.runtime.getURL("links.html") })}>Manage links</Button>
        {/snippet}
      </ModeOption>
    {/if}
    <ModeOption
      name="mode" value={SHARED} bind:group={mode} disabled={current?.managed}
      title="Shared, from your company's Cairn server" onselect={chooseShared}
    >
      {#snippet body()}
        <span>Everyone at your company sees the same links. You sign in with your company account through Cloudflare Access.</span>
        {#if status}<span class:error={status.warn}>{status.text}</span>{/if}
      {/snippet}
      {#snippet extra()}
        <ServerSetup bind:serverUrl {saveServer} onedit={() => { wantsShared = true; }} authenticate={authenticateServer} disabled={current?.managed} />
      {/snippet}
    </ModeOption>
    <Status {message} />
  </fieldset>

  <section>
    <h2>Display</h2>
    <div class="display">
      <span class="cn-label">Density</span>
      <Segmented
        label="Density" bind:value={display.density} onchange={changeDisplay}
        options={[{ value: "compact", label: "Compact" }, { value: "default", label: "Default" }, { value: "comfortable", label: "Comfortable" }] satisfies { value: Density; label: string }[]}
      />
      <span class="cn-label">Theme</span>
      <Segmented
        label="Theme" bind:value={display.theme} onchange={changeDisplay}
        options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] satisfies { value: Theme; label: string }[]}
      />
    </div>
    <p class="cn-hint">Comfortable shows each link's description under its name.</p>
  </section>

  <p class="cn-hint">Type <GoName name="name" /> in the address bar to open a link, or <b>go</b> then space to search.</p>
</Page>

<style>
  section, fieldset { display: grid; gap: var(--space-3); }
  fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
  h2, legend { font: var(--type-heading); padding: 0; }
  legend { margin-bottom: var(--space-3); }
  .error { color: var(--clay); }
  .display { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }
</style>
