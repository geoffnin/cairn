<!-- Copies text to the clipboard and says so on the button for a moment. `copy` can be replaced
     (tests, or a page that copies through the extension). -->
<script lang="ts">
  import Button from "./Button.svelte";
  import Kbd from "./Kbd.svelte";

  type Props = {
    text: string;
    label?: string;
    variant?: "default" | "primary";
    small?: boolean;
    /** A key hint after the button: "⌘C". */
    keys?: string;
    copy?: (text: string) => Promise<void>;
    oncopied?: (text: string) => void;
  };
  let {
    text, label = "Copy", variant = "default", small = false, keys,
    copy = (t) => navigator.clipboard.writeText(t), oncopied,
  }: Props = $props();
  let phase = $state<"idle" | "copied" | "failed">("idle");
  let copied = $state("");
  let timer: ReturnType<typeof setTimeout>;

  async function run() {
    clearTimeout(timer);
    const sent = text; // what this click copies, even if `text` changes while it is on its way
    try {
      await copy(sent);
      copied = sent;
      phase = "copied";
      oncopied?.(sent);
    } catch {
      phase = "failed";
    }
    timer = setTimeout(() => (phase = "idle"), 1600);
  }
</script>

<span class="copy">
  <Button {variant} {small} onclick={run}>{phase === "copied" ? "Copied" : phase === "failed" ? "Couldn’t copy" : label}</Button>
  {#if keys}<Kbd {keys} />{/if}
  <span class="cn-visually-hidden" role="status">{phase === "copied" ? `Copied ${copied}` : ""}</span>
</span>

<style>
  .copy { display: inline-flex; align-items: center; gap: var(--space-2); }
</style>
