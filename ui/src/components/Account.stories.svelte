<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Account from "./Account.svelte";

  const { Story } = defineMeta({ title: "Primitives/Account", component: Account, args: { email: "dev@example.com", signOutHref: "#signout" } });
</script>

<Story name="Signed in" />
