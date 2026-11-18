<!-- Settings: where links live (this browser or a shared server), and display. -->
<script lang="ts">
  import Button from "@cairn/ui/components/Button.svelte";
  import GoName from "@cairn/ui/components/GoName.svelte";
  import Header from "@cairn/ui/components/Header.svelte";
  import ModeOption from "@cairn/ui/components/ModeOption.svelte";
  import Page from "@cairn/ui/components/Page.svelte";
  import Segmented from "@cairn/ui/components/Segmented.svelte";
  import Status from "@cairn/ui/components/Status.svelte";
  import TextField from "@cairn/ui/components/TextField.svelte";
  import type { Message } from "@cairn/ui/lib/links";
  import { onMount, tick } from "svelte";
  import { LOCAL, SHARED, getState, hasServerAccess, normalizeServerUrl, probe, serverOrigins, setMode, setServer } from "../config.js";
  import { ext } from "../ext.js";
  import { countLinks } from "../local.js";
  import { applyDisplay, onDisplayChange, readDisplay, saveDisplay, type Density, type Theme } from "./display";

  type State = Awaited<ReturnType<typeof getState>>;
  type Server = NonNullable<State["server"]>;
  type ServerStatus = { text: string; warn?: boolean; action?: "grant" | "signin" };

  let current = $state<State | null>(null); // as last shown, so clicks can respond without waiting
  let mode = $state(LOCAL);
  // Shared chosen before any server is saved: shown as chosen, saved once a server is.
  let pendingShared = $state(false);
  let count = $state(0);
  let status = $state<ServerStatus | null>(null);
  let serverUrl = $state("");
  let serverInput: HTMLInputElement | undefined = $state();
  let saving = $state(false);
  let message = $state<Message | null>(null);
  const say = (text: string, error = false) => (message = { text, error });

  // Must run straight from a click: Chrome only shows the permission prompt for a user gesture.
  const requestAccess = (url: string) => ext.permissions.request({ origins: serverOrigins(url) }).catch(() => false);

  // Cloudflare Access signs people in on the server's own pages; opening the site starts it.
  function signIn(srv: Server) {
    ext.tabs.create({ url: `${srv.url}/_/` });
    say(`Sign in to ${srv.label} in the tab that just opened. This page updates when you come back.`);
  }

  async function sharedStatus(srv: Server): Promise<ServerStatus> {
    if (!(await hasServerAccess(srv))) return { text: "Needs permission to reach this server.", warn: true, action: "grant" };
    const p = await probe(srv);
    if (p.email) {
      // Back from the sign-in tab: replace the "sign in" prompt with the outcome.
      if (message?.text.startsWith(`Sign in to ${srv.label}`)) say(`Signed in to ${srv.label} as ${p.email}.`);
      return { text: `Signed in as ${p.email}.` };
    }
    if (p.signedOut) return { text: "Not signed in (or the server is not reachable).", warn: true, action: "signin" };
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
    mode = pendingShared && !state.server ? SHARED : state.mode;
    count = n;
    if (document.activeElement !== serverInput) serverUrl = state.server?.url ?? "";
    const s = state.server ? await sharedStatus(state.server) : null;
    if (seq === renderSeq) status = s;
  }

  function chooseLocal() {
    pendingShared = false;
    setMode(LOCAL).then(render);
  }

  function chooseShared() {
    if (current?.server) return void setMode(SHARED).then(render);
    // Nothing to switch to yet: links stay in this browser until a server is saved.
    pendingShared = true;
    tick().then(() => serverInput?.focus()); // once the field is enabled
    say("Enter your company's Cairn server address, then choose Use this server.");
  }

  async function useServer(e: SubmitEvent) {
    e.preventDefault();
    if (mode !== SHARED) return;
    let url: string;
    try {
      url = normalizeServerUrl(serverUrl);
    } catch (err) {
      return say((err as Error).message, true);
    }
    // Ask first, while the click still counts as a user gesture.
    if (!(await requestAccess(url))) return say(`Cairn needs permission to reach ${new URL(url).host} to use it.`, true);
    saving = true;
    try {
      const srv = { kind: "server", url, label: new URL(url).host } as Server;
      const p = await probe(srv);
      if (p.error) return say(p.error, true);
      await setServer(url);
      pendingShared = false;
      serverInput?.blur();
      if (p.email) say(`Using ${srv.label}, signed in as ${p.email}. Type go/ in the address bar.`);
      else signIn(srv);
    } finally {
      saving = false;
      render();
    }
  }

  async function grantAccess(srv: Server) {
    if (await requestAccess(srv.url)) say(`Access granted for ${srv.label}.`);
    render();
  }

  // Theme and density take effect at once, on every extension page.
  let display = $state(readDisplay());
  const changeDisplay = () => saveDisplay($state.snapshot(display));

  onMount(() => {
    const listener = () => render();
    ext.storage.onChanged.addListener(listener);
    // Coming back from the sign-in tab: show the new state.
    window.addEventListener("focus", listener);
    const stopDisplay = onDisplayChange((d) => {
      display = d;
      applyDisplay(d);
    });
    render();
    return () => {
      ext.storage.onChanged.removeListener(listener);
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
      <ModeOption name="mode" value={LOCAL} bind:group={mode} title="This browser" onselect={chooseLocal}>
        {#snippet body()}Stored only in this browser profile, not shared or synced · {count} link{count === 1 ? "" : "s"}{/snippet}
        {#snippet extra()}
          <Button onclick={() => ext.tabs.create({ url: ext.runtime.getURL("links.html") })}>Manage links</Button>
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
        <form class="server" onsubmit={useServer}>
          <TextField
            label="Server URL" mono bind:value={serverUrl} bind:input={serverInput} disabled={current?.managed || mode !== SHARED}
            placeholder="https://go.example.com" spellcheck={false} autocomplete="off"
          />
          {#if !current?.managed}<Button variant="primary" type="submit" disabled={saving || mode !== SHARED}>Use this server</Button>{/if}
        </form>
        {#if current?.server && status?.action === "grant"}
          {@const srv = current.server}
          <Button onclick={() => grantAccess(srv)}>Grant access</Button>
        {:else if current?.server && status?.action === "signin"}
          {@const srv = current.server}
          <Button onclick={() => signIn(srv)}>Sign in</Button>
        {/if}
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
  .server { display: flex; align-items: flex-end; flex-wrap: wrap; gap: var(--space-2); flex: 1 1 100%; }
  .error { color: var(--clay); }
  .display { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }
</style>
