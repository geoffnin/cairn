<!-- Welcome step 1: the choice of where links live, as two radio cards side by side (stacked on a
     narrow screen). This browser works with nothing set up, so it is the default. -->
<script lang="ts">
  import ModeOption from "./ModeOption.svelte";

  type Props = { mode?: "local" | "shared"; onchange?: (mode: "local" | "shared") => void };
  let { mode = $bindable("local"), onchange }: Props = $props();
  let group = $state<string>(mode);
  $effect.pre(() => {
    group = mode;
  });
  function select() {
    mode = group as "local" | "shared";
    onchange?.(mode);
  }
</script>

<fieldset>
  <legend class="cn-visually-hidden">Where your links live</legend>
  <ModeOption name="where" value="local" bind:group title="This browser" onselect={select}>
    {#snippet body()}Private to you, in this Chrome profile. Works now, nothing to set up. You can move these links to a server later.{/snippet}
  </ModeOption>
  <ModeOption name="where" value="shared" bind:group title="Your company’s server" onselect={select}>
    {#snippet body()}Everyone at work sees the same links. Ask whoever runs your tools for the address.{/snippet}
  </ModeOption>
</fieldset>

<style>
  fieldset { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); margin: 0; padding: 0; border: 0; }
</style>
