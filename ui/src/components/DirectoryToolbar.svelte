<!-- Above the server's list: the search (/ to focus), New link (c anywhere), which links to show
     with their counts, and the sort order. -->
<script lang="ts" module>
  export type Filter = "all" | "mine" | "new";
  export type Sort = "used" | "updated" | "name";
</script>

<script lang="ts">
  import { formatCount } from "../lib/format";
  import Button from "./Button.svelte";
  import Kbd from "./Kbd.svelte";
  import Search from "./Search.svelte";
  import Segmented from "./Segmented.svelte";
  import SelectField from "./SelectField.svelte";

  type Props = {
    q?: string;
    filter?: Filter;
    sort?: Sort;
    counts: Record<Filter, number>;
    oninput?: () => void;
    onfilter?: (filter: Filter) => void;
    onsort?: (sort: Sort) => void;
    onnew?: () => void;
  };
  let { q = $bindable(""), filter = $bindable("all"), sort = $bindable("used"), counts, oninput, onfilter, onsort, onnew }: Props = $props();

  function onWindowKey(e: KeyboardEvent) {
    const target = e.target as Element | null;
    if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, dialog, [contenteditable]")) return;
    e.preventDefault();
    onnew?.();
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="toolbar">
  <div class="top">
    <Search label="Search links" placeholder="Search {formatCount(counts.all)} links by name, destination or description" prominent bind:value={q} {oninput} />
    <Button variant="primary" onclick={onnew} aria-keyshortcuts="c">New link <Kbd keys="c" /></Button>
  </div>
  <div class="bottom">
    <Segmented
      label="Show" bind:value={filter} onchange={(v) => onfilter?.(v as Filter)}
      options={[
        { value: "all", label: "All", count: formatCount(counts.all) },
        { value: "mine", label: "Mine", count: formatCount(counts.mine) },
        { value: "new", label: "New this week", count: formatCount(counts.new) },
      ]}
    />
    <SelectField
      label="Sort" inline bind:value={sort} onchange={() => onsort?.(sort)}
      options={[{ value: "used", label: "Most used" }, { value: "updated", label: "Recently updated" }, { value: "name", label: "Name" }]}
    />
  </div>
</div>

<style>
  .toolbar { display: grid; gap: var(--space-4); }
  .top { display: flex; gap: var(--space-3); align-items: center; }
  .top :global(.btn) { height: var(--control-comfortable); padding-inline: var(--space-4); }
  .bottom { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
</style>
