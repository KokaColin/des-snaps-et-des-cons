<script lang="ts">
  import { route } from './lib/router.svelte';
  import { refreshSession } from './lib/session.svelte';
  import Home from './screens/Home.svelte';
  import Join from './screens/Join.svelte';
  import Library from './screens/Library.svelte';
  import Login from './screens/Login.svelte';
  import Room from './screens/Room.svelte';

  void refreshSession();

  const roomCode = $derived(/^\/p\/([A-Za-z]{5})\/?$/.exec(route.path)?.[1]?.toUpperCase() ?? null);
</script>

{#if roomCode}
  {#key roomCode}
    <Room code={roomCode} />
  {/key}
{:else if route.path === '/connexion'}
  <Login />
{:else if route.path === '/rejoindre'}
  <Join />
{:else if route.path === '/photos'}
  <Library />
{:else}
  <Home />
{/if}
