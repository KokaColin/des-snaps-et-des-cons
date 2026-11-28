<script lang="ts">
  // Court chargement entre deux manches : annonce de la suivante, plus forte pour la dernière.
  import type { GameView } from '../../../shared/view';

  let { view }: { view: GameView } = $props();
  const next = $derived(view.round + 1);
  const last = $derived(next >= view.totalRounds);
</script>

<main class="screen announce" class:last>
  {#if last}
    <svg class="burst" viewBox="0 0 300 300" aria-hidden="true">
      <polygon
        points="150,4 172,92 236,26 206,112 296,104 220,160 290,226 198,196 206,292 150,220 94,292 102,196 10,226 80,160 4,104 94,112 64,26 128,92"
        fill="#2b1340"
        stroke="#ff4d8d"
        stroke-width="4"
      />
    </svg>
    <p class="kicker">ATTENTION…</p>
    <h1 class="title">DERNIÈRE<br />MANCHE</h1>
  {:else}
    <p class="kicker">ON ENCHAÎNE</p>
    <h1 class="title">MANCHE {next}<small>/{view.totalRounds}</small></h1>
  {/if}
</main>

<style>
  .announce {
    justify-content: center;
    align-items: center;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .kicker {
    margin: 0;
    font-family: var(--bangers);
    font-size: 22px;
    letter-spacing: 3px;
    color: var(--text-2);
  }
  .title {
    margin: 0;
    font-family: var(--bangers);
    font-weight: 400;
    font-size: 72px;
    line-height: 0.95;
    letter-spacing: 2px;
    color: var(--yellow);
    -webkit-text-stroke: 6px #000;
    paint-order: stroke fill;
    text-shadow: 5px 5px 0 var(--pink);
    transform: skew(-8deg) rotate(-4deg);
    animation: slam 0.5s cubic-bezier(0.2, 1.6, 0.4, 1);
  }
  .title small {
    font-size: 0.5em;
  }
  .last .title {
    font-size: 84px;
    color: var(--pink);
    text-shadow: 6px 6px 0 var(--yellow);
    position: relative;
  }
  .last .kicker {
    position: relative;
    color: var(--yellow);
  }
  .burst {
    position: absolute;
    width: 150%;
    max-width: 700px;
    animation: spin 3s linear infinite;
  }
  @keyframes slam {
    from {
      transform: skew(-8deg) rotate(-4deg) scale(2.4);
      opacity: 0;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
