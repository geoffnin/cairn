<!-- Save on blur; authentication is a separate, explicit user gesture that opens a tab. -->
<script lang="ts">
  import type { Message } from "../lib/links";
  import { normalizeServerUrl, serverAuthenticationUrl } from "../lib/server.js";
  import Button from "./Button.svelte";
  import Status from "./Status.svelte";
  import TextField from "./TextField.svelte";

  type Props = {
    serverUrl?: string;
    saveServer: (url: string) => Promise<void>;
    authenticate?: (url: string) => void | Promise<void>;
    disabled?: boolean;
    onsaved?: (url: string) => void;
    onedit?: () => void;
    /** Lets the host replace sign-in feedback after probing the server on return. */
    onauthmessage?: (text: string, error?: boolean) => void;
  };
  let { serverUrl = $bindable(""), saveServer, authenticate = (url) => {
    window.open(serverAuthenticationUrl(url), "_blank", "noopener,noreferrer");
  }, disabled = false, onsaved, onedit, onauthmessage }: Props = $props();
  let address = $state(serverUrl);
  let error = $state("");
  let message = $state<Message | null>(null);
  let authMessage = $state<Message | null>(null);
  const sayAuth = (text: string, error = false) => {
    if (onauthmessage) onauthmessage(text, error);
    else authMessage = { text, error };
  };
  let authenticating = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let revision = 0;
  let editRevision = 0;
  let cleanEditRevision = 0;
  let observedUrl = serverUrl;
  let lastPersistedUrl = serverUrl;
  let saveFailed = false;
  let queue = Promise.resolve();
  let inFlight: { url: string; promise: Promise<boolean> } | null = null;
  $effect.pre(() => {
    const saved = serverUrl;
    if (saved === observedUrl) return;
    observedUrl = saved;
    lastPersistedUrl = saved;
    // External updates must not erase a newer (possibly invalid) edit.
    if (editRevision === cleanEditRevision) { address = saved; error = ""; }
  });

  function readAddress() {
    try { const url = normalizeServerUrl(address); error = ""; return url; }
    catch (err) { error = (err as Error).message; return null; }
  }

  function persist(url: string): Promise<boolean> {
    if (inFlight?.url === url) return inFlight.promise;
    if (!inFlight && !saveFailed && lastPersistedUrl === url) {
      address = url; cleanEditRevision = editRevision; return Promise.resolve(true);
    }
    const seq = ++revision;
    const edited = editRevision;
    message = { text: "Saving server address…" };
    // Serialize writes so a slower old save cannot overwrite a newer address.
    const promise = queue.then(async () => {
      try {
        await saveServer(url);
        lastPersistedUrl = url;
        if (seq === revision) {
          saveFailed = false;
          observedUrl = url;
          serverUrl = url;
          if (edited === editRevision) { address = url; cleanEditRevision = edited; }
          onsaved?.(url);
          if (edited === editRevision) message = { text: "Server address saved." };
        }
        return true;
      } catch (err) {
        if (seq === revision) { saveFailed = true; message = { text: (err as Error).message, error: true }; }
        return false;
      } finally {
        if (seq === revision) inFlight = null;
      }
    });
    queue = promise.then(() => {});
    inFlight = { url, promise };
    return promise;
  }

  function saveAddress() {
    if (disabled) return;
    const url = readAddress();
    if (url) void persist(url);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (authenticating) return;
    const url = readAddress();
    if (!url) return;
    const saved = disabled ? Promise.resolve(true) : persist(url);
    authenticating = true;
    try {
      // Invoke before awaiting persistence: opening a tab/asking Chrome permission needs this gesture.
      await authenticate(url);
      sayAuth(`Sign in to ${new URL(url).host} in the tab that just opened. This page updates when you come back.`);
    } catch (err) {
      sayAuth((err as Error).message, true);
    } finally {
      await saved;
      authenticating = false;
    }
  }
</script>

<form onsubmit={submit} aria-label="Configure your company’s server">
  <TextField label="Server URL" mono bind:value={address} bind:input {error} disabled={disabled || authenticating}
    onblur={saveAddress} oninput={() => { editRevision++; error = ""; message = null; onedit?.(); }}
    placeholder="go.example.com or localhost:8787" spellcheck={false} autocomplete="url"
    hint={disabled ? "Your organization set this address. Authenticate opens sign-in in a new tab." : "The address saves automatically when you leave this field. Authenticate opens your server’s sign-in page in a new tab."}>
    {#snippet controlAction()}
      <Button variant="primary" type="submit" disabled={authenticating}>{authenticating ? "Opening…" : "Authenticate"}</Button>
    {/snippet}
  </TextField>
  <Status {message} />
  {#if !onauthmessage}<Status message={authMessage} />{/if}
</form>

<style>
  form { display: grid; gap: var(--space-3); min-width: 0; width: 100%; }
</style>
