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
  };
  let { serverUrl = $bindable(""), saveServer, authenticate = (url) => {
    window.open(serverAuthenticationUrl(url), "_blank", "noopener,noreferrer");
  }, disabled = false, onsaved, onedit }: Props = $props();
  let address = $state(serverUrl);
  let error = $state("");
  let message = $state<Message | null>(null);
  let authenticating = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let revision = 0;
  let editRevision = 0;
  let queue = Promise.resolve();
  let inFlight: { url: string; promise: Promise<boolean> } | null = null;
  $effect.pre(() => {
    const saved = serverUrl;
    if (document.activeElement !== input) address = saved;
  });

  function readAddress() {
    try { const url = normalizeServerUrl(address); error = ""; return url; }
    catch (err) { error = (err as Error).message; return null; }
  }

  function persist(url: string): Promise<boolean> {
    if (inFlight?.url === url) return inFlight.promise;
    if (!inFlight && serverUrl === url) { address = url; return Promise.resolve(true); }
    const seq = ++revision;
    const edited = editRevision;
    message = { text: "Saving server address…" };
    // Serialize writes so a slower old save cannot overwrite a newer address.
    const promise = queue.then(async () => {
      try {
        await saveServer(url);
        if (seq === revision) {
          serverUrl = url;
          if (document.activeElement !== input) address = url;
          onsaved?.(url);
          if (edited === editRevision) message = { text: "Server address saved." };
        }
        return true;
      } catch (err) {
        if (seq === revision) message = { text: (err as Error).message, error: true };
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
      if (await saved) message = { text: "Finish signing in in the new tab, then return here." };
    } catch (err) {
      await saved;
      message = { text: (err as Error).message, error: true };
    } finally { authenticating = false; }
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
</form>

<style>
  form { display: grid; gap: var(--space-3); min-width: 0; width: 100%; }
</style>
