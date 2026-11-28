<script lang="ts">
  // Écran de partie : chaque phase a son écran. Le serveur fait avancer tout le salon ensemble ;
  // un joueur qui revient retombe directement sur la phase en cours.
  import type { GameView } from '../../shared/view';
  import { go } from '../lib/router.svelte';
  import type { Room } from '../lib/room.svelte';
  import Announce from './game/Announce.svelte';
  import Editor from './game/Editor.svelte';
  import Final from './game/Final.svelte';
  import Results from './game/Results.svelte';
  import Vote from './game/Vote.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();
</script>

{#if view.phase === 'creation' && view.creation}
  {#key view.round}
    <Editor {room} {view} />
  {/key}
{:else if view.phase === 'vote' && view.vote}
  {#key `${view.round}-${view.vote.index}`}
    <Vote {room} {view} />
  {/key}
{:else if view.phase === 'results' && view.results}
  <Results {room} {view} />
{:else if view.phase === 'loading'}
  <Announce {view} />
{:else if view.phase === 'final' && view.final}
  <Final {room} {view} />
{:else if view.phase === 'aborted'}
  <main class="screen center">
    <h1 class="punk">PARTIE ARRÊTÉE</h1>
    <p class="msg">Trop peu de joueurs connectés pendant une minute : la partie s'arrête et ne compte pas.</p>
    <button class="ghost" onclick={() => go('/')}>Retour à l'accueil</button>
  </main>
{:else}
  <main class="screen center"><p class="hint">Chargement…</p></main>
{/if}

<style>
  .center {
    justify-content: center;
    text-align: center;
    gap: 16px;
  }
  h1 {
    font-size: 40px;
    align-self: center;
  }
  .msg {
    font-weight: 700;
  }
</style>
