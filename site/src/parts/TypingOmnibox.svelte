<!-- The design system's address-bar picture, typing a few names in turn, so a visitor sees what
     the extension does before reading a word. Still, on the first name, with reduced motion. -->
<script lang="ts">
  import OmniboxPreview from "@cairn/ui/components/OmniboxPreview.svelte";
  import { onMount } from "svelte";

  type Scene = { typed: string; suggestions: { slug: string; description: string }[] };
  const scenes: Scene[] = [
    { typed: "road", suggestions: [
      { slug: "roadmap", description: "Product roadmap, 2027" },
      { slug: "roadmap-infra", description: "Platform roadmap" },
      { slug: "road-trip", description: "Offsite travel plans" },
    ] },
    { typed: "oncall", suggestions: [
      { slug: "oncall", description: "Who’s on call right now" },
      { slug: "oncall-runbooks", description: "Runbooks for paged alerts" },
      { slug: "oncall-swap", description: "Swap a shift" },
    ] },
    { typed: "bug/ABC-12", suggestions: [
      { slug: "bug/ABC-12", description: "Open a ticket by key → tracker.example.com/browse/ABC-12" },
      { slug: "bugs", description: "Team bug board" },
      { slug: "bug-bash", description: "Friday bug bash sign-up" },
    ] },
  ];

  let scene = $state(0);
  let length = $state(scenes[0]!.typed.length);
  const current = $derived(scenes[scene]!);
  const typed = $derived(current.typed.slice(0, length));
  const shown = $derived(length === 0 ? [] : current.suggestions.filter((s) => s.slug.startsWith(typed.split("/")[0]!)));

  onMount(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const wait = (ms: number) => new Promise<void>((r) => (timer = setTimeout(r, ms)));
    let alive = true;
    (async () => {
      await wait(2400);
      while (alive) {
        while (alive && length > 0) { length--; await wait(35); }
        scene = (scene + 1) % scenes.length;
        await wait(350);
        while (alive && length < current.typed.length) { length++; await wait(85 + Math.random() * 60); }
        await wait(2600);
      }
    })();
    return () => { alive = false; clearTimeout(timer); };
  });
</script>

<div class="stage">
  <OmniboxPreview {typed} suggestions={shown} />
</div>

<style>
  .stage { display: grid; justify-items: center; min-height: 172px; align-content: start; }
  .stage :global(.omnibox) { font-size: 15px; }
  .stage :global(.bar) { height: 48px; }
  .stage :global(.row) { padding: 10px 16px; }
</style>
