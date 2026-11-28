<script lang="ts">
  import type { GameView } from '../../../shared/view';
  import GameHeader from '../../components/GameHeader.svelte';
  import MemeCanvas from '../../components/MemeCanvas.svelte';
  import { errorMessage } from '../../lib/errors';
  import { vibrate } from '../../lib/meme-render';
  import { noteStyle } from '../../lib/note-style';
  import type { Room } from '../../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const vote = $derived(view.vote!);
  let note = $state(11);
  let sending = $state(false);
  // Note affichée : celle déjà validée si elle existe, sinon celle du curseur.
  const shown = $derived(vote.myNote ?? note);
  const look = $derived(noteStyle(shown));
  const locked = $derived(vote.myNote !== null || sending);

  function send() {
    vibrate();
    sending = true;
    room.send({ type: 'vote', index: vote.index, note });
    setTimeout(() => (sending = false), 3000);
  }
</script>

<main class="screen vote">
  <GameHeader {view} {room} info={vote.isMine ? '' : `${vote.voted}/${vote.voters} ont noté`}>
    {#snippet title()}MEME {vote.index + 1}<small>/{vote.count}</small>{/snippet}
  </GameHeader>

  <div class="progress" aria-hidden="true">
    {#each Array.from({ length: vote.count }, (_, i) => i) as i (i)}
      <span class:past={i < vote.index} class:now={i === vote.index}></span>
    {/each}
  </div>

  <div class="pola">
    <span class="tape" aria-hidden="true"></span>
    <MemeCanvas photoId={vote.meme.photoId} layers={vote.meme.layers} />
    <span class="mystery">auteur : mystère</span>
  </div>

  {#if vote.isMine}
    <div class="mine">
      <p class="punk">C'EST LE TIEN</p>
      <p class="hint">Pas de vote pour toi sur celui-là. Les autres notent…</p>
    </div>
  {:else}
    <div class="note" aria-live="polite">
      {#if look.legendary}
        <svg class="boom" width="300" height="128" viewBox="0 0 300 128" aria-hidden="true">
          <polygon points="150,2 166,40 206,10 192,50 248,30 212,62 290,64 214,74 252,104 196,86 210,126 166,92 150,126 134,92 90,126 104,86 48,104 86,74 10,64 88,62 52,30 108,50 94,10 134,40" fill="#ff4d8d" />
          <polygon points="150,22 160,48 186,32 178,58 214,52 188,70 232,74 188,82 206,104 174,90 176,112 154,94 142,114 136,92 108,108 120,84 80,90 112,72 72,58 116,60 96,36 128,50 128,26 142,46" fill="#ffe433" />
        </svg>
      {/if}
      <span class="num-wrap">
        <span class="num" style={look.style}>{shown}</span>
        <span class="max">/22</span>
      </span>
    </div>
    <p class="caption" style={look.captionStyle}>{look.caption}</p>

    <label class="slider">
      <span class="sr-only">Ta note sur 22</span>
      <input type="range" min="0" max="22" step="1" bind:value={note} disabled={locked} class="note-range" />
    </label>

    {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}

    <button class="big submit" onclick={send} disabled={locked}>
      {vote.myNote !== null ? 'NOTE ENVOYÉE' : 'Valider ma note'}
    </button>
  {/if}
</main>

<style>
  .vote {
    gap: 14px;
  }
  .progress {
    display: flex;
    gap: 6px;
  }
  .progress span {
    flex: 1;
    height: 6px;
    background: #3a3833;
  }
  .progress .past {
    background: var(--paper);
  }
  .progress .now {
    background: var(--pink);
  }
  .pola {
    position: relative;
    align-self: center;
    width: min(100%, 340px);
    padding: 10px 10px 30px;
    background: var(--paper);
    transform: rotate(1.2deg);
    box-shadow: 5px 5px 0 #000;
  }
  .tape {
    position: absolute;
    z-index: 1;
    top: -12px;
    right: 22px;
    width: 76px;
    height: 22px;
    background: var(--tape);
    transform: rotate(6deg);
  }
  .mystery {
    position: absolute;
    bottom: 6px;
    left: 12px;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-4);
  }
  .mine {
    margin: auto 0;
    text-align: center;
  }
  .mine .punk {
    font-size: 40px;
  }
  .note {
    position: relative;
    height: 128px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .boom {
    position: absolute;
    left: 50%;
    top: 0;
    margin-left: -150px;
    animation: boom 0.35s ease-out;
  }
  @keyframes boom {
    from {
      transform: scale(0.3) rotate(-20deg);
      opacity: 0;
    }
  }
  .num-wrap {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .num {
    display: inline-block;
    font-family: var(--bangers);
    line-height: 0.9;
    letter-spacing: 4px;
    paint-order: stroke fill;
    transition: transform 0.12s;
  }
  .max {
    display: inline-block;
    font-family: var(--bangers);
    font-size: 40px;
    letter-spacing: 1px;
    -webkit-text-stroke: 5px #000;
    paint-order: stroke fill;
    color: var(--paper);
    transform: skew(-5deg);
  }
  .caption {
    margin: -4px 0 0;
    min-height: 22px;
    text-align: center;
    font-family: var(--bangers);
    font-size: 20px;
    letter-spacing: 2px;
  }
  .slider {
    display: block;
  }
  .note-range {
    width: 100%;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
    height: 40px;
    background: transparent;
  }
  .note-range::-webkit-slider-runnable-track {
    height: 12px;
    border: 0;
    background: linear-gradient(90deg, #4a463e 0 4%, #8f8a7f 4.5%, #f3ecdc 50%, #ffe433 54%, #ff8a1f 92%, #ff4d8d 96%);
  }
  .note-range::-moz-range-track {
    height: 12px;
    border: 0;
    background: linear-gradient(90deg, #4a463e 0 4%, #8f8a7f 4.5%, #f3ecdc 50%, #ffe433 54%, #ff8a1f 92%, #ff4d8d 96%);
  }
  .note-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 30px;
    height: 30px;
    margin-top: -9px;
    background: var(--paper);
    border: 0;
    box-shadow: 3px 3px 0 #000;
    transform: rotate(45deg);
  }
  .note-range::-moz-range-thumb {
    width: 26px;
    height: 26px;
    background: var(--paper);
    border: 0;
    border-radius: 0;
    box-shadow: 3px 3px 0 #000;
    transform: rotate(45deg);
  }
  .note-range:disabled {
    opacity: 0.5;
  }
  .submit {
    margin-top: auto;
  }
</style>
