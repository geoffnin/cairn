<!-- A labelled text input. `go` puts the go/ prefix inside the field, so typing the name
     finishes the address. `error` shows under the field and marks the input invalid. -->
<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "value"> & {
    label: string;
    value?: string;
    input?: HTMLInputElement;
    go?: boolean;
    mono?: boolean;
    hint?: string;
    error?: string;
    class?: string;
  };
  let {
    label, value = $bindable(""), input = $bindable(), go = false, mono = false,
    hint, error, class: className = "", type = "text", ...rest
  }: Props = $props();
</script>

<label class="field {className}">
  <span class="cn-label">{label}</span>
  <span class="box" class:go>
    <input
      bind:this={input} bind:value {type}
      class="cn-control" class:is-mono={mono || go}
      aria-invalid={error ? "true" : undefined}
      {...rest}
    />
  </span>
  {#if error}<span class="cn-hint is-error">{error}</span>{:else if hint}<span class="cn-hint">{hint}</span>{/if}
</label>

<style>
  .field { display: grid; gap: var(--space-1); min-width: 0; align-content: start; }
  .box { position: relative; display: block; }
  .go::before {
    content: "go/"; position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%);
    font-family: var(--font-mono); font-size: 13px; color: var(--ink-muted); pointer-events: none;
  }
  .go input { padding-left: calc(var(--space-3) + 3ch); }
</style>
