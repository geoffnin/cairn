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
  let state = $state<"idle" | "copied" | "failed">("idle");
  let timer: ReturnType<typeof setTimeout>;

  async function run() {
    clearTimeout(timer);
    try {
      await copy(text);
      state = "copied";
      oncopied?.(text);
    } catch {
      state = "failed";
    }
    timer = setTimeout(() => (state = "idle"), 1600);
  }
</script>

<span class="copy">
  <Button {variant} {small} onclick={run}>{state === "copied" ? "Copied" : state === "failed" ? "Couldn’t copy" : label}</Button>
  {#if keys}<Kbd {keys} />{/if}
  <span class="cn-visually-hidden" role="status">{state === "copied" ? `Copied ${text}` : ""}</span>
</span>

<style>
  .copy { display: inline-flex; align-items: center; gap: var(--space-2); }
</style>
