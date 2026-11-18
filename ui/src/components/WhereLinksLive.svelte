<!-- The radio selection can be a setup draft. Shared mode is committed only after the
     host has configured the server successfully; choosing a card alone never connects. -->
<script lang="ts">
  import type { Message } from "../lib/links";
  import { normalizeServerUrl } from "../lib/server.js";
  import Button from "./Button.svelte";
  import ModeOption from "./ModeOption.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    mode?: "local" | "shared";
    serverUrl?: string;
    pending?: boolean;
    onchange?: (mode: "local" | "shared") => void;
    /** Resolves once the host has saved the server and completed any permission/sign-in flow. */
    connect: (url: string) => Promise<void>;
  };
  let { mode = $bindable("local"), serverUrl = $bindable(""), pending = $bindable(false), onchange, connect }: Props = $props();
  let group = $state<string>(mode);
  let address = $state(serverUrl);
  let busy = $state(false);
  let error = $state("");
  let message = $state<Message | null>(null);
  $effect.pre(() => { group = mode; });
  $effect.pre(() => { address = serverUrl; });
  $effect.pre(() => { pending = group === "shared" && (busy || mode !== "shared" || !serverUrl); });

  function select() {
    message = null;
    if (group === "shared" && !serverUrl) return;
    mode = group as "local" | "shared";
    onchange?.(mode);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    error = "";
    message = null;
    let url: string;
    try { url = normalizeServerUrl(address); }
    catch (err) { error = (err as Error).message; return; }
    busy = true;
    try {
      await connect(url);
      serverUrl = url;
      mode = "shared";
      onchange?.(mode);
      message = { text: `Using ${new URL(url).host}.` };
    } catch (err) {
      message = { text: (err as Error).message, error: true };
    } finally {
      busy = false;
    }
  }
</script>

<fieldset>
  <legend class="cn-visually-hidden">Where your links live</legend>
  <ModeOption name="where" value="local" bind:group title="This browser" disabled={busy} onselect={select}>
    {#snippet body()}Private to you, in this Chrome profile. Works now, nothing to set up. You can move these links to a server later.{/snippet}
  </ModeOption>
  <ModeOption name="where" value="shared" bind:group title="Your company’s server" disabled={busy} onselect={select}>
    {#snippet body()}Everyone at work sees the same links. Ask whoever runs your tools for the address.{/snippet}
  </ModeOption>
</fieldset>

{#if group === "shared"}
  <form onsubmit={submit} aria-label="Configure your company’s server" aria-busy={busy}>
    <TextField label="Server URL" mono bind:value={address} {error} disabled={busy}
      placeholder="https://go.example.com" spellcheck={false} autocomplete="url"
      hint="Enter your company’s Cairn address. You may be asked to allow access and sign in with your company account." />
    <Button variant="primary" type="submit" disabled={busy}>{busy ? "Connecting…" : "Use this server"}</Button>
    <div class="status"><Status {message} /></div>
  </form>
{/if}

<style>
  fieldset { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
  form { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--space-3); }
  form :global(.btn) { margin-top: calc(1lh + var(--space-1)); }
  .status { grid-column: 1 / -1; }
  @media (max-width: 560px) {
    form { grid-template-columns: minmax(0, 1fr); }
    form :global(.btn) { margin-top: 0; justify-self: start; }
  }
</style>
