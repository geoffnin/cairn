<!-- A small mono label for where something lives: "local" or "remote" in the popup's corner.
     `title` says it in full. -->
<script lang="ts">
  let { label, title }: { label: string; title?: string } = $props();
</script>

<span class="tag" {title}>{label}{#if title}<span class="cn-visually-hidden">: {title}</span>{/if}</span>

<style>
  .tag {
    display: inline-block; padding: 1px 6px;
    font: var(--type-kbd); color: var(--ink-muted);
    background: var(--surface-sunken); border-radius: var(--radius-sm);
  }
</style>
