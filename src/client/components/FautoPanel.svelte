<script lang="ts">
  // Gadget Fauto pendant les résultats : autocollant pour le détenteur, puis
  // activer → roulette (3 screens random) → choix de la photo et de la cible → envoi.
  import type { GameView } from '../../shared/view';
  import { errorMessage } from '../lib/errors';
  import { photoUrl, vibrate } from '../lib/meme-render';
  import type { Room } from '../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const f = $derived(view.fauto);
  const mine = $derived(f.mine);
  const usable = $derived(
    !!mine && f.windowOpen && mine.status === 'ready' && (mine.lockedUntilRound === null || mine.lockedUntilRound <= view.round),
  );
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? '?';
  const lastWindow = $derived(view.round + 1 >= view.totalRounds);

  let photo = $state<string | null>(null);
  let target = $state<string | null>(null);

  $effect(() => {
    // Nouvelle roulette : on repart sans sélection.
    void mine?.offer.join();
    photo = null;
    target = null;
  });

  function op(action: { op: 'activate' } | { op: 'cancel' } | { op: 'spin' }) {
    vibrate();
    room.send({ type: 'gadget', gadget: 'fauto', ...action });
  }

  function send() {
    if (!photo || !target) return;
    vibrate(40);
    room.send({ type: 'gadget', gadget: 'fauto', op: 'send', photoId: photo, targetId: target });
  }

  function cancelAfterSpin() {
    const msg = lastWindow
      ? 'Annuler maintenant ? Ta Fauto sera perdue (dernière occasion).'
      : 'Annuler maintenant ? Ta Fauto sera inutilisable jusqu’aux prochains résultats.';
    if (confirm(msg)) op({ op: 'cancel' });
  }
</script>

{#if f.windowOpen && mine}
  {#if usable}
    <button
      class="big sticker"
      class:empty={f.libraryEmpty}
      onclick={() => op({ op: 'activate' })}
      disabled={f.libraryEmpty}
      aria-label="Lancer ma Fauto"
    >
      <span class="tag">TU EN AS UNE</span>
      <span class="word">FAUTO !</span>
      <span class="sub">
        {f.libraryEmpty ? 'Bibliothèque Fauto vide : ajoute des screens random dans la photothèque' : 'Touche pour imposer un screen random'}
      </span>
    </button>
  {:else if mine.status === 'ready' && mine.lockedUntilRound !== null && mine.lockedUntilRound > view.round}
    <p class="note">Ta Fauto revient aux prochains résultats.</p>
  {:else if mine.status === 'used'}
    <p class="note">Fauto envoyée !</p>
  {/if}
{:else if f.windowOpen && f.inCirculation > 0}
  <p class="note">{f.inCirculation} Fauto en circulation…</p>
{/if}

{#if mine && f.windowOpen && (mine.status === 'activated' || mine.status === 'spun')}
  <div class="backdrop" role="presentation"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Fauto">
    <h2 class="punk">FAUTO !</h2>
    {#if mine.status === 'activated'}
      <p class="hint">La roulette tire 3 screens random. Tu en choisiras un et ta cible.</p>
      <button class="big" onclick={() => op({ op: 'spin' })}>LANCER LA ROULETTE</button>
      <button class="link" onclick={() => op({ op: 'cancel' })}>Annuler (sans conséquence)</button>
    {:else}
      <p class="hint">1. Choisis le screen random</p>
      <div class="offer">
        {#each mine.offer as id, i (id)}
          <button class="pick" class:on={photo === id} style:animation-delay="{i * 0.12}s" onclick={() => (photo = id)}>
            <img src={photoUrl(id, 'thumb')} alt="Screen random {i + 1}" />
          </button>
        {/each}
      </div>
      <p class="hint">2. Choisis ta cible (son prochain meme)</p>
      <div class="targets">
        {#each mine.targets as id (id)}
          <button class="ghost" class:selected={target === id} onclick={() => (target = id)}>{nameOf(id)}</button>
        {/each}
      </div>
      {#if mine.targets.length === 0}<p class="hint">Plus aucune cible libre pour cette manche.</p>{/if}
      {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}
      <button class="big pink" onclick={send} disabled={!photo || !target}>ENVOYER LA FAUTO</button>
      <button class="link" onclick={cancelAfterSpin}>Annuler</button>
    {/if}
  </div>
{/if}

<style>
  .sticker {
    position: fixed;
    z-index: 15;
    right: 18px;
    bottom: max(28px, env(safe-area-inset-bottom));
    width: 186px;
    min-height: 0;
    padding: 12px 14px;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
    transform: rotate(-7deg);
    clip-path: polygon(0 4%, 30% 0, 62% 3%, 100% 0, 98% 52%, 100% 100%, 55% 97%, 22% 100%, 1% 96%, 3% 48%);
    animation: pop 0.4s ease-out;
  }
  .sticker:active:not(:disabled) {
    transform: rotate(-7deg) translate(4px, 4px);
  }
  .sticker.empty {
    border: 0;
    background: #8a8373;
    color: var(--ink);
  }
  @keyframes pop {
    from {
      transform: rotate(-30deg) scale(0.2);
    }
  }
  .tag {
    font-size: 14px;
    letter-spacing: 1px;
    background: var(--red);
    color: var(--paper);
    padding: 2px 7px;
    transform: rotate(-3deg);
  }
  .word {
    font-size: 44px;
    line-height: 0.95;
  }
  .sub {
    font-family: var(--archivo);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.2;
  }
  .note {
    margin: 0;
    text-align: center;
    font-family: var(--bangers);
    font-size: 20px;
    letter-spacing: 1px;
    color: var(--yellow);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(0, 0, 0, 0.65);
  }
  .sheet {
    position: fixed;
    z-index: 21;
    left: 50%;
    bottom: 0;
    width: min(100%, 480px);
    max-height: 92dvh;
    overflow-y: auto;
    transform: translateX(-50%);
    padding: 20px 16px max(20px, env(safe-area-inset-bottom));
    background: var(--bg);
    border-top: 3px solid var(--yellow);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sheet h2 {
    font-size: 40px;
    color: var(--yellow);
  }
  .offer {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .pick {
    padding: 4px;
    border: 0;
    background: var(--paper);
    box-shadow: 3px 3px 0 #000;
    cursor: pointer;
    animation: spin-in 0.45s ease-out both;
  }
  .pick img {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
  }
  .pick.on {
    outline: 3px solid var(--yellow);
    outline-offset: 3px;
  }
  @keyframes spin-in {
    from {
      transform: rotateY(90deg) scale(0.6);
      opacity: 0;
    }
  }
  .targets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .targets .ghost {
    flex: 1 1 40%;
  }
</style>
