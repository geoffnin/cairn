<!-- A labelled text input. `go` puts the go/ prefix inside the field, so typing the name
     finishes the address. `note` follows the label in muted text ("· this tab"); `action` sits at
     the label line's end (a quiet link-button); `trail` sits just right of the input (a
     NameCheckMark). Under the field: `error` (clay, marks the input invalid), else `help` (rich),
     else `hint`. Both are tied to the input with aria-describedby, as is `describedby` (an id
     elsewhere, such as a Notice). No field here holds a credential, so password managers are told
     to leave them alone (1Password, LastPass, Bitwarden; they ignore autocomplete="off"). -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "value"> & {
    label: string;
    value?: string;
    input?: HTMLInputElement;
    go?: boolean;
    mono?: boolean;
    note?: string;
    hint?: string;
    error?: string;
    /** Marks the input invalid when the reason is shown elsewhere (a Notice, via describedby). */
    invalid?: boolean;
    help?: Snippet;
    action?: Snippet;
    trail?: Snippet;
    describedby?: string;
    class?: string;
  };
  let {
    label, value = $bindable(""), input = $bindable(), go = false, mono = false,
    note, hint, error, invalid = false, help, action, trail, describedby, class: className = "", type = "text", id: ownId, ...rest
  }: Props = $props();
  const generated = $props.id();
  const id = $derived(ownId ?? generated);
  const inputId = $derived(ownId ?? `${generated}-input`);
  const below = $derived(Boolean(error || help || hint));
  const described = $derived([below ? `${id}-below` : "", describedby ?? ""].filter(Boolean).join(" ") || undefined);
</script>

<div class="field {className}">
  <div class="top">
    <label class="cn-label" for={inputId}>{label}{#if note}{" "}<span class="note">{note}</span>{/if}</label>
    {#if action}<span class="action">{@render action()}</span>{/if}
  </div>
  <span class="control">
    <span class="box" class:go>
      <input
        bind:this={input} bind:value {type} id={inputId}
        class="cn-control" class:is-mono={mono || go}
        aria-invalid={error || invalid ? "true" : undefined} aria-describedby={described}
        data-1p-ignore data-lpignore="true" data-bwignore
        {...rest}
      />
    </span>
    {#if trail}{@render trail()}{/if}
  </span>
  {#if error}<span class="cn-hint is-error" id="{id}-below">{error}</span>
  {:else if help}<span class="cn-hint" id="{id}-below">{@render help()}</span>
  {:else if hint}<span class="cn-hint" id="{id}-below">{hint}</span>{/if}
</div>

<style>
  .field { display: grid; gap: var(--space-1); min-width: 0; align-content: start; }
  .top { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
  .note { font-weight: 400; color: var(--ink-faint); }
  .action { font: var(--type-small); }
  .control { display: flex; align-items: center; gap: var(--space-2); }
  .box { position: relative; display: block; flex: 1; min-width: 0; }
  .go::before {
    content: "go/"; position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%);
    font-family: var(--font-mono); font-size: 13px; color: var(--ink-muted); pointer-events: none;
  }
  .go input { padding-left: calc(var(--space-3) + 3ch); }
</style>
