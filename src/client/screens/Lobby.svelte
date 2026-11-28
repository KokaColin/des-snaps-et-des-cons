<script lang="ts">
  import type { GameView } from '../../shared/view';
  import Logo from '../components/Logo.svelte';
  import { colorFor, initial } from '../lib/colors';
  import { blockerMessage, errorMessage } from '../lib/errors';
  import type { Room } from '../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const me = $derived(view.players.find((p) => p.id === view.me));
  const isHost = $derived(me?.isHost ?? false);
  const guests = $derived(view.players.filter((p) => p.kind === 'guest').length);
  const maxPlayers = $derived(view.lobby?.maxPlayers ?? 7);
  const maxGuests = $derived(view.lobby?.maxGuests ?? 3);
  const readyCount = $derived(view.players.filter((p) => p.ready).length);
  const blockers = $derived(view.lobby?.blockers ?? []);
  const waitingFor = $derived(view.players.filter((p) => !p.ready).map((p) => p.name));
  const tilt = (i: number) => [-0.6, 0.5, -0.3, 0.7, -0.4, 0.4, -0.5][i % 7];

  let copied = $state<string | null>(null);
  const link = $derived(`${location.origin}/p/${view.code}`);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = label;
      setTimeout(() => (copied = null), 1500);
    } catch {
      copied = null;
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Des Snaps et des Cons', text: `Partie ${view.code}`, url: link });
        return;
      } catch {
        // partage annulé : on copie le lien à la place
      }
    }
    await copy(link, 'lien');
  }

  function kick(id: string, name: string) {
    if (confirm(`Retirer ${name} du salon ?`)) room.send({ type: 'kick', playerId: id });
  }

  function leave() {
    if (confirm('Quitter le salon ?')) room.leave();
  }

  /** Empêchements autres que « pas prêt » (déjà montré par le compteur). */
  const otherBlockers = $derived(blockers.filter((b) => b !== 'players_not_ready'));
</script>

<main class="screen">
  <Logo />

  <div class="taped code">
    <span class="code-label">code de la partie</span>
    <span class="code-value">{view.code}</span>
  </div>

  <div class="share">
    <button class="ghost" onclick={share}>{copied === 'lien' ? 'Lien copié !' : 'Partager le lien'}</button>
    <button class="ghost" onclick={() => copy(view.code, 'code')}>{copied === 'code' ? 'Copié !' : 'Copier le code'}</button>
  </div>

  <div class="count">
    <h1 class="punk">{view.players.length} JOUEUR{view.players.length > 1 ? 'S' : ''}</h1>
    <span>
      {#if view.players.length >= maxPlayers}complet{:else}{maxPlayers - view.players.length} place{maxPlayers - view.players.length > 1 ? 's' : ''}{/if}
      · invités {guests}/{maxGuests}
    </span>
  </div>

  <ul class="players">
    {#each view.players as p, i (p.id)}
      <li class="row" style:transform="rotate({tilt(i)}deg)">
        <span class="av" class:guest={p.kind === 'guest'} style:background={colorFor(p.name) ?? 'var(--paper)'}>
          {initial(p.name)}
        </span>
        <span class="name">
          {p.name}
          {#if p.isHost}<small>· orga</small>{/if}
          {#if p.kind === 'guest'}<small>· invité</small>{/if}
          {#if p.id === view.me}<small>· toi</small>{/if}
        </span>
        {#if p.absent}
          <span class="stamp ko">ABSENT</span>
        {:else if p.ready}
          <span class="stamp ok">PRÊT</span>
        {:else}
          <span class="later">pas encore prêt</span>
        {/if}
        {#if isHost && p.id !== view.me}
          <button class="kick" onclick={() => kick(p.id, p.name)} aria-label="Retirer {p.name}">×</button>
        {/if}
      </li>
    {/each}
    {#if view.players.length < maxPlayers}
      <li class="free">place libre</li>
    {/if}
  </ul>

  <div class="bottom">
    {#if waitingFor.length > 0}
      <p class="wait">En attente de {waitingFor.join(', ').replace(/, ([^,]*)$/, ' et $1')}</p>
    {/if}
    {#each otherBlockers as b (b)}
      <p class="wait">{blockerMessage(b)}</p>
    {/each}
    {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}

    {#if isHost}
      <button class="big" disabled={blockers.length > 0} onclick={() => room.send({ type: 'start' })}>
        Lancer la partie <span class="count">{readyCount}/{view.players.length} PRÊTS</span>
      </button>
    {:else if me?.ready}
      <button class="big paper" onclick={() => room.send({ type: 'ready', ready: false })}>
        PRÊT ! <span class="count">annuler</span>
      </button>
    {:else}
      <button class="big" onclick={() => room.send({ type: 'ready', ready: true })}>Je suis prêt</button>
    {/if}
    <button class="link" onclick={leave}>Quitter le salon</button>
  </div>
</main>

<style>
  .code {
    align-self: center;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .code-label {
    font-weight: 600;
    font-size: 13px;
  }
  .code-value {
    font-family: var(--bangers);
    font-size: 40px;
    letter-spacing: 6px;
    line-height: 1.05;
  }
  .share {
    display: flex;
    gap: 10px;
  }
  .share .ghost {
    flex: 1;
  }
  .count {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .count h1 {
    font-size: 34px;
  }
  .count > span {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-2);
  }
  .players {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .av.guest {
    border: 2px dashed #8f8a7f;
  }
  .name {
    flex: 1;
    font-weight: 900;
    font-size: 17px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .name small {
    font-weight: 400;
    font-size: 12px;
  }
  .ok {
    color: var(--ok);
  }
  .ko {
    color: var(--ko);
  }
  .later {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-4);
  }
  .kick {
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
    color: var(--text-4);
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
  }
  .kick:hover {
    color: var(--ko);
  }
  .free {
    min-height: 38px;
    border: 2px dashed rgba(243, 236, 220, 0.35);
    display: grid;
    place-items: center;
    font-weight: 600;
    font-size: 13px;
    color: #b9b19f;
  }
  .bottom {
    margin-top: auto;
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .wait {
    margin: 0;
    font-weight: 600;
    font-size: 13px;
    color: var(--text-2);
    text-align: center;
  }
</style>
