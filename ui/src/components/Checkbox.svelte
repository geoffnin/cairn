<!-- A binary setting or filter; moss when checked. Keep labels short and positive. -->
<script lang="ts">
  let { checked = $bindable(false), label, onchange }: { checked?: boolean; label: string; onchange?: () => void } = $props();
</script>

<label class="check"><input type="checkbox" bind:checked {onchange} /> {label}</label>

<style>
  .check { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--ink); cursor: pointer; white-space: nowrap; }
  input {
    appearance: none; margin: 0; width: 16px; height: 16px; flex: none;
    display: grid; place-content: center;
    background: var(--surface); border: 1px solid var(--line-control); border-radius: var(--radius-sm);
    transition: background-color 120ms var(--ease-quick);
  }
  input::after {
    content: ""; width: 8px; height: 4px; opacity: 0;
    border: 2px solid var(--on-moss); border-top: 0; border-right: 0;
    transform: translateY(-1px) rotate(-45deg);
  }
  input:checked { background: var(--moss); border-color: var(--moss); }
  input:checked::after { opacity: 1; }
</style>
