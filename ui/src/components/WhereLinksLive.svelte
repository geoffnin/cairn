<!-- Shared mode starts when the entered address is saved; authentication is a separate action. -->
<script lang="ts">
  import ModeOption from "./ModeOption.svelte";
  import ServerSetup from "./ServerSetup.svelte";

  type Props = {
    mode?: "local" | "shared";
    serverUrl?: string;
    pending?: boolean;
    onchange?: (mode: "local" | "shared") => void;
    saveServer: (url: string) => Promise<void>;
    authenticate?: (url: string) => void | Promise<void>;
  };
  let { mode = $bindable("local"), serverUrl = $bindable(""), pending = $bindable(false), onchange, saveServer, authenticate }: Props = $props();
  let group = $state<string>(mode);
  $effect.pre(() => { group = mode; });
  $effect.pre(() => { pending = group === "shared" && (mode !== "shared" || !serverUrl); });

  function select() {
    if (group === "shared" && !serverUrl) return;
    mode = group as "local" | "shared";
    onchange?.(mode);
  }

  function saved() {
    // Saving an address does not claim that authentication has completed.
    if (group === "shared") {
      mode = "shared";
      onchange?.(mode);
    }
  }
</script>

<fieldset>
  <legend class="cn-visually-hidden">Where your links live</legend>
  <ModeOption name="where" value="local" bind:group title="This browser" onselect={select}>
    {#snippet body()}Private to you, in this Chrome profile. Works now, nothing to set up. You can move these links to a server later.{/snippet}
  </ModeOption>
  <ModeOption name="where" value="shared" bind:group title="Your company’s server" onselect={select}>
    {#snippet body()}Everyone at work sees the same links. Ask whoever runs your tools for the address.{/snippet}
  </ModeOption>
</fieldset>

<div hidden={group !== "shared"}>
  <ServerSetup bind:serverUrl {saveServer} {authenticate} onsaved={saved} />
</div>

<style>
  fieldset { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; min-width: 0; }
</style>
