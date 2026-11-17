<!-- The filter above a list: a sunken field with its shortcut as a kbd hint. "/" anywhere on the
     page focuses it; Esc clears it and leaves. -->
<script lang="ts">
  let { value = $bindable(""), label, oninput }: { value?: string; label: string; oninput?: () => void } = $props();
  let input: HTMLInputElement;

  function onWindowKey(e: KeyboardEvent) {
    const target = e.target as Element | null;
    if (e.key === "/" && !target?.closest("input, textarea, select, dialog, [contenteditable]")) {
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

<div class="search">
  <input
    bind:this={input} bind:value {oninput} onkeydown={onKey}
    class="cn-control" type="search" placeholder={label} aria-label={label} aria-keyshortcuts="/" autocomplete="off"
  />
  <span class="cn-kbd" aria-hidden="true">/</span>
</div>

<style>
  .search { position: relative; flex: 1 1 240px; }
  input { background: var(--surface-sunken); padding-right: 40px; }
  .cn-kbd { position: absolute; right: var(--space-2); top: 50%; transform: translateY(-50%); pointer-events: none; }
  .search:focus-within .cn-kbd { display: none; }
</style>
