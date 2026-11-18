<!-- Stories only: the directory page over the fixture links, searching, filtering and sorting in
     memory the way the server would. -->
<script lang="ts">
  import DirectoryPage from "../components/DirectoryPage.svelte";
  import type { Filter, Sort } from "../components/DirectoryToolbar.svelte";
  import type { DirectoryLink } from "../lib/links";
  import { directory, HOST, ME, NOW } from "./fixtures";

  type Props = {
    selected?: number;
    fresh?: string | null;
    onnew?: () => void;
    onopen?: (l: DirectoryLink) => void;
    oncopy?: (l: DirectoryLink) => void;
    onedit?: (l: DirectoryLink) => void;
  };
  let { selected = -1, fresh = "q4", ...callbacks }: Props = $props();
  let q = $state("");
  let filter = $state<Filter>("all");
  let sort = $state<Sort>("updated");
  const week = NOW.getTime() - 7 * 86_400_000;
  const isNew = (l: DirectoryLink) => Date.parse(l.updated) > week;

  const shown = $derived.by(() => {
    const term = q.trim().toLowerCase();
    return [...directory]
      .filter((l) => !term || [l.slug, l.url, l.description].some((v) => v.toLowerCase().includes(term)))
      .filter((l) => filter === "all" || (filter === "mine" ? l.owner === ME : isNew(l)))
      .sort((a, b) => (sort === "name" ? a.slug.localeCompare(b.slug) : b.updated.localeCompare(a.updated)))
      // A link just made stays on top, where it was set down.
      .sort((a, b) => Number(b.slug === fresh) - Number(a.slug === fresh));
  });
</script>

<DirectoryPage
  host={HOST} me={ME} now={NOW} links={shown} counts={{ all: 214, mine: 12, new: 5 }} {fresh} {selected}
  bind:q bind:filter bind:sort href={(l) => `#/${l.slug}`} {...callbacks}
/>
