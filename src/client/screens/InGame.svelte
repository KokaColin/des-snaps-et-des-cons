<script lang="ts">
  // Écran de partie provisoire (lot 2) : montre que tout le salon avance ensemble, au bon chrono,
  // et qu'un joueur qui revient retombe au bon endroit. Les vrais écrans arrivent au lot 3.
  import { format } from '../../shared/fraction';
  import type { GameView } from '../../shared/view';
  import Countdown from '../components/Countdown.svelte';
  import { errorMessage } from '../lib/errors';
  import { go } from '../lib/router.svelte';
  import type { Room } from '../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const PHASES: Record<string, string> = {
    creation: 'Création',
    vote: 'Vote',
    results: 'Résultats',
    loading: 'Manche suivante…',
    final: 'Fin de partie',
    aborted: 'Partie arrêtée',
  };
  const me = $derived(view.players.find((p) => p.id === view.me));
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
</script>

<main class="screen">
  <header>
    <h1 class="punk">
      {#if view.phase === 'final' || view.phase === 'aborted'}
        {PHASES[view.phase]}
      {:else}
        MANCHE {view.round}<small>/{view.totalRounds}</small>
      {/if}
    </h1>
    {#if view.deadline}
      <Countdown deadline={view.deadline} start={view.phaseStartedAt} now={() => room.serverNow()} />
    {/if}
  </header>

  {#if view.phase !== 'final' && view.phase !== 'aborted'}
    <p class="phase">{PHASES[view.phase] ?? view.phase}</p>
    {#if view.phase === 'vote' && view.vote}
      <p class="hint">Meme {view.vote.index + 1}/{view.vote.count}{view.vote.isMine ? ' · c’est le tien' : ''}</p>
    {/if}
    <div class="wip taped">
      <strong>Chantier en cours</strong>
      <span>Les écrans de jeu arrivent au lot 3. Ici, les chronos tournent et la partie avance toute seule pour tout le
        monde.</span>
    </div>
  {/if}

  {#if view.phase === 'aborted'}
    <p class="msg">Trop peu de joueurs connectés pendant une minute : la partie est arrêtée et ne compte pas.</p>
  {/if}

  {#if view.phase === 'final' && view.final}
    <ol class="standings">
      {#each view.final.results.standings as s (s.playerId)}
        <li class="row"><span class="rank">#{s.rank}</span><span class="who">{nameOf(s.playerId)}</span><span class="pts">{format(s.total)}</span></li>
      {/each}
    </ol>
  {/if}

  <ul class="players">
    {#each view.players as p (p.id)}
      <li>
        <span class:absent={p.absent}>{p.name}{p.id === view.me ? ' (toi)' : ''}</span>
        {#if p.absent}<span class="stamp ko">ABSENT</span>{:else if p.done}<span class="stamp ok">FAIT</span>{/if}
        {#if p.isHost}<small>orga</small>{/if}
      </li>
    {/each}
  </ul>

  {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}

  <div class="bottom">
    {#if view.phase === 'final' && me?.isHost}
      <button class="big pink" onclick={() => room.send({ type: 'rematch' })}>REVANCHE !</button>
    {/if}
    {#if view.phase === 'final' || view.phase === 'aborted'}
      <button class="ghost" onclick={() => go('/')}>Retour à l'accueil</button>
    {/if}
  </div>
</main>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  header h1 {
    font-size: 40px;
  }
  .phase {
    margin: 0;
    font-family: var(--bangers);
    font-size: 30px;
    letter-spacing: 1px;
    color: var(--yellow);
  }
  .wip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 18px 0;
    font-size: 14px;
  }
  .msg {
    font-weight: 700;
  }
  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .players li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
  }
  .players small {
    color: var(--text-3);
  }
  .absent {
    opacity: 0.5;
  }
  .ok {
    color: #6fdc7a;
  }
  .ko {
    color: var(--pink);
  }
  .standings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .rank,
  .pts {
    font-family: var(--bangers);
    font-size: 22px;
  }
  .who {
    flex: 1;
    font-weight: 900;
  }
  .bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
