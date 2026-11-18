<!-- The filter above a list: a field with its shortcut as a kbd hint. "/" anywhere on the page
     focuses it; Esc clears it and leaves. `prominent` makes it the page's main control: taller,
     with a search icon. `placeholder` can say more than the label ("Search 214 links"). -->
<script lang="ts">
  import Icon from "./Icon.svelte";

  type Props = { value?: string; label: string; placeholder?: string; prominent?: boolean; oninput?: () => void };
  let { value = $bindable(""), label, placeholder = label, prominent = false, oninput }: Props = $props();
  let input: HTMLInputElement;

  function onWindowKey(e: KeyboardEvent) {
    const target = e.target as Element | null;
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !target?.closest("input, textarea, select, dialog, [contenteditable]")) {
      e.preventDefault();
      input.focus();
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    value = "";
    input.blur();
    oninput?.();
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="search" class:prominent>
  {#if prominent}<span class="glass"><Icon name="search" /></span>{/if}
  <input
    bind:this={input} bind:value {oninput} onkeydown={onKey}
    class="cn-control" type="search" {placeholder} aria-label={label} aria-keyshortcuts="/" autocomplete="off"
  />
  <span class="cn-kbd" aria-hidden="true">/</span>
</div>

<style>
  .search { position: relative; flex: 1 1 240px; }
  input { padding-right: 40px; }
  .cn-kbd { position: absolute; right: var(--space-2); top: 50%; transform: translateY(-50%); pointer-events: none; }
  .search:focus-within .cn-kbd { display: none; }
  .prominent input { height: var(--control-comfortable); padding-left: 36px; }
  .glass { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); display: flex; color: var(--ink-muted); pointer-events: none; }
</style>
