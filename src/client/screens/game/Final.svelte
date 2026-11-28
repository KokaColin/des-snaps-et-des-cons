<script lang="ts">
  import { onDestroy } from 'svelte';
  import { compare, format, type Fraction } from '../../../shared/fraction';
  import type { MemeResult, Standing } from '../../../shared/types';
  import type { GameView } from '../../../shared/view';
  import ScoredMeme from '../../components/ScoredMeme.svelte';
  import { errorMessage } from '../../lib/errors';
  import { vibrate } from '../../lib/meme-render';
  import { go } from '../../lib/router.svelte';
  import type { Room } from '../../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const final = $derived(view.final!);
  const standings = $derived(final.results.standings);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const me = $derived(view.players.find((p) => p.id === view.me));

  // Révélation du dernier au premier, puis podium.
  let revealed = $state(0);
  const done = $derived(revealed >= standings.length);
  const timer = setInterval(() => {
    revealed += 1;
    if (revealed >= standings.length) {
      clearInterval(timer);
      vibrate(60);
    }
  }, 900);
  onDestroy(() => clearInterval(timer));
  const reverse = $derived([...standings].reverse());

  const podium = $derived(
    [standings[1], standings[0], standings[2]].map((s, i) => (s ? { s, place: [2, 1, 3][i] as number } : null)),
  );
  const standingOf = (id: string) => standings.find((s) => s.playerId === id) as Standing;

  const badges = $derived([
    { key: 'goofy', label: 'goofy ass gwero', ids: final.results.badges.goofy, value: (s: Standing) => s.total, unit: 'PTS' },
    { key: 'broke', label: 'broke ass gwero', ids: final.results.badges.broke, value: (s: Standing) => s.total, unit: 'PTS' },
    {
      key: 'shame',
      label: 'shame ass gwero',
      ids: final.results.badges.shame,
      value: (s: Standing) => s.averageGiven as Fraction,
      unit: 'DE MOYENNE',
    },
  ]);

  // Récap : tous les memes de la partie, du meilleur au pire.
  const recap = $derived(
    final.rounds
      .flatMap((r, roundIndex) => r.memes.map((m) => ({ m, round: roundIndex + 1 })))
      .sort((a, b) => compare(b.m.score, a.m.score) || a.round - b.round) as { m: MemeResult; round: number }[],
  );
  let strip = $state<HTMLDivElement | null>(null);
  let position = $state(1);
  function onScroll() {
    if (!strip) return;
    const card = strip.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 26 : 1;
    position = Math.min(recap.length, Math.round(strip.scrollLeft / step) + 1);
  }
</script>

{#if !done}
  <main class="screen reveal">
    <h1 class="punk">LE CLASSEMENT…</h1>
    <ol class="rows">
      {#each reverse.slice(0, revealed) as s (s.playerId)}
        <li class="row reveal-row" class:first={s.rank === 1}>
          <span class="place">#{s.rank}</span>
          <span class="who">{nameOf(s.playerId)}</span>
          <span class="pts">{format(s.total)} <small>PTS</small></span>
        </li>
      {/each}
    </ol>
    <button class="link" onclick={() => (revealed = standings.length)}>Tout voir</button>
  </main>
{:else}
  <main class="screen final">
    <div class="title">
      <span class="t1">FIN</span>
      <span class="t2">DE PARTIE</span>
    </div>

    <div class="podium">
      {#each podium as slot, i (i)}
        <div class="col">
          {#if slot}
            <span class="name" class:winner={slot.place === 1}>{nameOf(slot.s.playerId)}</span>
            <span class="pts">{format(slot.s.total)} <small>PTS</small></span>
            <div class="step" class:gold={slot.place === 1} style:height="{slot.place === 1 ? 110 : slot.place === 2 ? 80 : 60}px">
              {slot.s.rank}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="badges">
      {#each badges as b (b.key)}
        {#if b.ids.length > 0}
          <div class="badge">
            {#if b.key === 'goofy'}
              <svg width="30" height="30" viewBox="0 0 30 30" role="img" aria-label="Couronne : le plus de points">
                <path d="M4 21L5.5 8.5L11 14.5L15 5.5L19 14.5L24.5 8.5L26 21Z" fill="#ffe433" /><rect x="4" y="22.5" width="22" height="3.5" fill="#ffe433" />
              </svg>
            {:else if b.key === 'broke'}
              <svg width="30" height="30" viewBox="0 0 30 30" role="img" aria-label="Pièce cassée : le moins de points">
                <path d="M14 3.5A11.5 11.5 0 0 0 14 26.5L16 20L12.5 15L16 9.5Z" fill="#f3ecdc" />
                <path d="M17.5 4A11.5 11.5 0 0 1 17.5 26L19.5 19.5L16 15L19.5 9.5Z" fill="#f3ecdc" transform="translate(1.5 1) rotate(6 22 15)" />
              </svg>
            {:else}
              <svg width="30" height="30" viewBox="0 0 30 30" role="img" aria-label="Rat : le plus radin dans ses notes">
                <path d="M7 21.5C3 21 1.5 24.5 4 26.5C6 28 9.5 27 12 25.5" fill="none" stroke="#f3ecdc" stroke-width="1.8" stroke-linecap="round" />
                <path d="M6 21.5C6 15 11 11.5 17 12C21 12.3 24 14.5 26 17.2L28.5 18.6L26 20C24.5 21.6 21.5 22.5 17.5 22.5H8C6.8 22.5 6 22.2 6 21.5Z" fill="#f3ecdc" />
                <circle cx="19" cy="11" r="3.4" fill="#f3ecdc" /><circle cx="19" cy="11" r="1.8" fill="#e63b2e" />
                <circle cx="23.3" cy="16.3" r="1.1" fill="#17161b" /><circle cx="28.4" cy="18.6" r="1.1" fill="#e63b2e" />
                <path d="M11 22.5V25M19 22.5V25" stroke="#f3ecdc" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            {/if}
            <span class="bn-wrap"><span class="bn {b.key}">{b.label}</span></span>
            <span class="holders">
              {#each b.ids as id (id)}
                <span class="holder">
                  <strong>{nameOf(id)}</strong>
                  <span class="pts small">{format(b.value(standingOf(id)))} <small>{b.unit}</small></span>
                </span>
              {/each}
            </span>
          </div>
        {/if}
      {/each}
    </div>

    <div class="recap-head">
      <h2 class="punk">TOUS LES MEMES</h2>
      <span>{recap.length} · du meilleur au pire</span>
    </div>
    <div class="strip" bind:this={strip} onscroll={onScroll}>
      {#each recap as { m, round }, i (`${round}-${m.authorId}`)}
        <div class="card">
          <ScoredMeme meme={m} {nameOf} top={i === 0} tilt={i % 2 === 0 ? -1.5 : 1.5} caption="manche {round}" voters={false} download compact />
        </div>
      {/each}
    </div>
    <span class="counter">{position} <span>/ {recap.length}</span></span>

    {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}
    <div class="bottom">
      {#if me?.isHost}
        <button class="big pink" onclick={() => room.send({ type: 'rematch' })}>Revanche !</button>
      {:else}
        <p class="hint center">L'orga peut lancer une revanche avec les mêmes joueurs.</p>
      {/if}
      <button class="link" onclick={() => go('/')}>Retour à l'accueil</button>
    </div>
  </main>
{/if}

<style>
  .reveal {
    gap: 16px;
  }
  .reveal h1 {
    font-size: 40px;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
  }
  .reveal-row {
    animation: drop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1);
  }
  .reveal-row.first {
    background: var(--yellow);
    box-shadow: 4px 4px 0 var(--pink);
  }
  @keyframes drop {
    from {
      transform: translateY(-30px) rotate(-3deg);
      opacity: 0;
    }
  }
  .place {
    font-family: var(--bangers);
    font-size: 24px;
    width: 40px;
  }
  .row .who {
    flex: 1;
    font-weight: 900;
    font-size: 18px;
  }
  .row .pts {
    color: var(--ink);
  }
  .final {
    gap: 12px;
  }
  .title {
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
  }
  .t1,
  .t2 {
    padding: 2px 8px;
    color: var(--ink);
    font-family: var(--bangers);
    font-size: 40px;
    letter-spacing: 2px;
    line-height: 1;
    box-shadow: 4px 4px 0 #000;
  }
  .t1 {
    background: var(--paper);
    transform: skew(-8deg) rotate(-4deg);
  }
  .t2 {
    background: var(--pink);
    transform: skew(-8deg) rotate(3deg);
  }
  .podium {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    align-items: end;
    margin-top: 6px;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .name {
    font-weight: 900;
    font-size: 16px;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .name.winner {
    font-size: 18px;
  }
  .pts {
    display: inline-block;
    font-family: var(--bangers);
    font-size: 22px;
    letter-spacing: 1.5px;
    line-height: 1;
    color: var(--yellow);
    transform: skew(-8deg) rotate(-2deg);
    white-space: nowrap;
  }
  .pts small {
    font-size: 0.6em;
  }
  .pts.small {
    font-size: 18px;
  }
  .step {
    width: 100%;
    display: flex;
    justify-content: center;
    padding-top: 6px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 3px 3px 0 #000;
    font-family: var(--bangers);
    font-size: 38px;
    animation: rise 0.6s ease-out both;
    transform-origin: bottom;
  }
  .step.gold {
    background: var(--yellow);
    box-shadow: 4px 4px 0 var(--pink);
    font-size: 52px;
  }
  @keyframes rise {
    from {
      transform: scaleY(0);
    }
  }
  .badges {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .badge {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 16px;
    background: var(--band);
    clip-path: polygon(0 12%, 4% 0, 38% 6%, 71% 0, 100% 8%, 97% 48%, 100% 92%, 66% 100%, 30% 94%, 2% 100%, 3% 55%);
  }
  .badge:nth-child(even) {
    transform: rotate(0.8deg);
  }
  .badge:nth-child(odd) {
    transform: rotate(-0.6deg);
  }
  .badge svg {
    flex: none;
  }
  .bn-wrap {
    display: inline-flex;
    filter: drop-shadow(2px 2px 0 #000);
  }
  .bn {
    font-family: var(--bangers);
    font-size: 18px;
    line-height: 1.1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 11px;
    transform: skew(-6deg) rotate(-3deg);
    clip-path: polygon(4% 0, 52% 7%, 97% 2%, 100% 48%, 96% 100%, 45% 93%, 1% 97%, 0 40%);
    white-space: nowrap;
  }
  .bn.goofy {
    background: var(--yellow);
    color: var(--ink);
  }
  .bn.broke {
    background: var(--paper);
    color: var(--ink);
  }
  .bn.shame {
    background: var(--red);
    color: var(--paper);
  }
  .holders {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: flex-end;
  }
  .holder {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.15;
  }
  .recap-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .recap-head h2 {
    font-size: 30px;
  }
  .recap-head span {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-2);
  }
  .strip {
    display: flex;
    gap: 26px;
    margin: -8px -16px 0 0;
    padding: 36px 40px 10px 8px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .card {
    flex: none;
    width: min(68vw, 240px);
    scroll-snap-align: start;
  }
  .counter {
    align-self: center;
    font-family: var(--bangers);
    font-size: 18px;
    line-height: 1;
  }
  .counter span {
    color: var(--text-3);
  }
  .bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .center {
    text-align: center;
  }
</style>
