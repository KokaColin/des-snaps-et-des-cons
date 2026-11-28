<script lang="ts">
  // Polaroïd d'un meme noté : score tagué sur le coin, rang, tampons « 22 · prénom », auteur.
  import { format } from '../../shared/fraction';
  import type { MemeResult } from '../../shared/types';
  import { downloadMeme } from '../lib/meme-render';
  import MemeCanvas from './MemeCanvas.svelte';

  let {
    meme,
    nameOf,
    rank = null,
    top = false,
    tilt = 0,
    caption = '',
    voters = true,
    download = false,
    compact = false,
  }: {
    meme: MemeResult;
    nameOf: (id: string) => string;
    rank?: number | null;
    top?: boolean;
    tilt?: number;
    caption?: string;
    voters?: boolean;
    download?: boolean;
    /** Petite carte (récap de fin) : score tagué plus petit et plus haut. */
    compact?: boolean;
  } = $props();

  const notes = $derived(Object.entries(meme.votes).sort((a, b) => b[1] - a[1]));
  const maxed = $derived(notes.filter(([, n]) => n === 22).map(([id]) => nameOf(id)));
  const others = $derived(notes.filter(([, n]) => n !== 22));
  const stampSpots = [
    'bottom: -8px; left: -14px; transform: rotate(-10deg)',
    'bottom: 52px; right: -16px; transform: rotate(8deg)',
    'top: 40%; left: -12px; transform: rotate(-6deg)',
    'top: 18%; right: -12px; transform: rotate(5deg)',
    'bottom: 26%; left: 30%; transform: rotate(3deg)',
    'top: 8%; left: 20%; transform: rotate(-4deg)',
  ];
  let saving = $state(false);

  async function save() {
    saving = true;
    try {
      await downloadMeme(meme.recipe, `meme-${nameOf(meme.authorId)}-${format(meme.score).replace(',', '-')}.jpg`);
    } finally {
      saving = false;
    }
  }
</script>

<article class="pola" style:transform="rotate({tilt}deg)">
  <div class="ph">
    <MemeCanvas photoId={meme.recipe.photoId} layers={meme.recipe.layers} />
    {#each maxed.slice(0, stampSpots.length) as name, i (name)}
      <span class="s22" style={stampSpots[i]}>22 · {name}</span>
    {/each}
  </div>
  <span class="impact" class:top class:compact style:transform="skew(-5deg) rotate({tilt > 0 ? -5 : 6}deg)" aria-label="Score {format(meme.score)} sur 22">
    {format(meme.score)}<small>/22</small>
  </span>
  {#if rank !== null}<span class="rank">#{rank}</span>{/if}
  {#if meme.legendary}<span class="legend">LÉGENDAIRE</span>{/if}
  <div class="foot">
    <span class="who">
      <strong>{nameOf(meme.authorId)}</strong>
      {#if caption}<small>{caption}</small>{/if}
      {#if meme.imposedBy}<small class="fauto">Fauto de {nameOf(meme.imposedBy)}</small>{/if}
    </span>
    {#if voters && others.length > 0}
      <span class="notes">
        {#each others as [id, n] (id)}<span>{nameOf(id)} {n}</span>{/each}
      </span>
    {/if}
    {#if voters && notes.length === 0}
      <span class="notes"><span>aucun vote</span></span>
    {/if}
    {#if download}
      <button class="dl" onclick={save} disabled={saving} aria-label="Télécharger ce meme">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3V13M5.5 9L10 13.5L14.5 9M4 17H16" fill="none" stroke="#17161b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    {/if}
  </div>
</article>

<style>
  .pola {
    position: relative;
    padding: 9px 9px 12px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: 5px 5px 0 #000;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .ph {
    position: relative;
  }
  .s22 {
    position: absolute;
    z-index: 1;
    padding: 0 4px;
    background: var(--paper);
    color: var(--ko);
    border: 2px solid var(--ko);
    font-family: var(--bangers);
    letter-spacing: 1px;
    font-size: 13px;
    white-space: nowrap;
  }
  .impact {
    position: absolute;
    z-index: 2;
    top: -24px;
    right: -6px;
    display: flex;
    align-items: baseline;
    font-family: var(--bangers);
    font-size: 52px;
    line-height: 1.15;
    letter-spacing: 2px;
    color: var(--paper);
    -webkit-text-stroke: 5px #000;
    paint-order: stroke fill;
    text-shadow: 3px 3px 0 var(--pink);
  }
  .impact.top {
    color: var(--yellow);
  }
  .impact.compact {
    top: -30px;
    font-size: 40px;
    -webkit-text-stroke-width: 4px;
  }
  .impact small {
    font-size: 0.42em;
  }
  .rank {
    position: absolute;
    z-index: 2;
    top: -12px;
    left: -8px;
    padding: 2px 8px;
    background: var(--bg);
    color: var(--paper);
    font-family: var(--bangers);
    font-size: 18px;
    transform: rotate(-5deg);
  }
  .legend {
    position: absolute;
    z-index: 2;
    top: 30px;
    left: -10px;
    padding: 2px 8px;
    background: var(--yellow);
    color: var(--ink);
    font-family: var(--bangers);
    font-size: 16px;
    letter-spacing: 1px;
    transform: rotate(-8deg);
    box-shadow: 2px 2px 0 var(--pink);
  }
  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .who {
    display: flex;
    flex-direction: column;
  }
  .who strong {
    font-weight: 900;
    font-size: 18px;
  }
  .who small {
    font-weight: 600;
    font-size: 12px;
    color: #4a453c;
  }
  .who .fauto {
    color: var(--ko);
  }
  .notes {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 2px 8px;
    font-weight: 600;
    font-size: 13px;
    color: #4a453c;
  }
  .dl {
    width: 44px;
    height: 44px;
    flex: none;
    display: grid;
    place-items: center;
    border: 0;
    background: var(--yellow);
    padding: 0;
    cursor: pointer;
  }
  .dl:disabled {
    opacity: 0.5;
  }
</style>
