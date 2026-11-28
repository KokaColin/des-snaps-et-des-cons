<script lang="ts">
  import type { GameView } from '../../../shared/view';
  import FautoPanel from '../../components/FautoPanel.svelte';
  import GameHeader from '../../components/GameHeader.svelte';
  import ScoredMeme from '../../components/ScoredMeme.svelte';
  import type { Room } from '../../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const results = $derived(view.results!);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  // Rang avec places partagées (1, 1, 3…) sur le score de la manche.
  const ranks = $derived(
    results.memes.map((m, i) => {
      const firstSame = results.memes.findIndex((o) => o.score.n * m.score.d === m.score.n * o.score.d);
      return firstSame === -1 ? i + 1 : firstSame + 1;
    }),
  );
</script>

<main class="screen results">
  <GameHeader {view} {room}>
    {#snippet title()}RÉSULTATS <small>MANCHE {view.round}</small>{/snippet}
  </GameHeader>

  <div class="list">
    {#each results.memes as meme, i (meme.authorId)}
      <ScoredMeme
        {meme}
        {nameOf}
        rank={ranks[i]}
        top={results.winners.includes(meme.authorId)}
        tilt={i % 2 === 0 ? -1 : 1}
        caption={meme.authorId === view.me ? 'toi' : ''}
      />
    {/each}
  </div>

  <FautoPanel {room} {view} />
</main>

<style>
  .results {
    gap: 12px;
    padding-bottom: 180px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 40px;
    padding: 30px 12px 0 4px;
  }
</style>
