<!-- A radio card for a choice with consequences: where links live. The chosen card takes
     moss-soft with a moss border. `extra` holds the option's own controls. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    name: string;
    value: string;
    group: string;
    title: string;
    disabled?: boolean;
    onselect?: () => void;
    body?: Snippet;
    extra?: Snippet;
  };
  let { name, value, group = $bindable(), title, disabled = false, onselect, body, extra }: Props = $props();
  const id = $props.id();
</script>

<div class="mode" class:chosen={group === value}>
  <input type="radio" id="{id}-radio" {name} {value} {disabled} bind:group onchange={onselect} />
  <label for="{id}-radio">{title}</label>
  {#if body}<span class="body">{@render body()}</span>{/if}
  {#if extra}<div class="extra">{@render extra()}</div>{/if}
</div>

<style>
  .mode {
    display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: var(--space-1) var(--space-3);
    padding: var(--space-4);
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-lg);
    transition: border-color 120ms var(--ease-quick), background-color 120ms var(--ease-quick);
  }
  .mode:hover { border-color: var(--line-control); }
  .chosen, .chosen:hover { background: var(--moss-soft); border-color: var(--moss); }
  input {
    appearance: none; width: 16px; height: 16px; margin: 2px 0 0;
    background: var(--surface); border: 1px solid var(--line-control); border-radius: var(--radius-full);
    cursor: pointer;
  }
  input:checked { border: 5px solid var(--moss); }
  input:disabled { opacity: .5; cursor: default; }
  label { font-weight: 600; cursor: pointer; }
  .body, .extra { grid-column: 2; }
  .body { display: grid; gap: var(--space-1); font: var(--type-small); color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .extra { display: flex; align-items: flex-end; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
  .extra :global(.field) { flex: 1 1 220px; }
</style>
