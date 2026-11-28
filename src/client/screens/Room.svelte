<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ByeReason } from '../../shared/protocol';
  import { errorMessage } from '../lib/errors';
  import { go } from '../lib/router.svelte';
  import { hasDeviceToken, Room } from '../lib/room.svelte';
  import { session } from '../lib/session.svelte';
  import InGame from './InGame.svelte';
  import Lobby from './Lobby.svelte';

  let { code }: { code: string } = $props();

  const GUEST_KEY = 'dsdc:pseudo';
  let room = $state<Room | null>(null);
  let askName = $state(false);
  let name = $state(readGuestName());
  let nameError = $state<string | null>(null);

  function readGuestName(): string {
    try {
      return localStorage.getItem(GUEST_KEY) ?? '';
    } catch {
      return '';
    }
  }

  $effect(() => {
    if (!session.loaded || room || askName) return;
    if (session.member || hasDeviceToken(code)) room = new Room(code, null);
    else askName = true;
  });

  // Fin de connexion qui demande un pseudo (invité sans jeton valide) ou un nouvel essai.
  $effect(() => {
    const bye = room?.bye;
    if (!bye || !room) return;
    if (bye === 'need_name' || bye === 'invalid_token' || (bye === 'join_refused' && !session.member)) {
      nameError = room.lastError ? errorMessage(room.lastError) : null;
      room.destroy();
      room = null;
      askName = true;
    } else if (bye === 'left') {
      go('/');
    }
  });

  onDestroy(() => room?.destroy());

  function joinAsGuest(event: SubmitEvent) {
    event.preventDefault();
    const clean = name.replace(/\s+/g, ' ').trim();
    if (!clean || [...clean].length > 12) {
      nameError = errorMessage('invalid_name');
      return;
    }
    try {
      localStorage.setItem(GUEST_KEY, clean);
    } catch {
      // pas grave
    }
    nameError = null;
    askName = false;
    room = new Room(code, clean);
  }

  function retry() {
    room?.destroy();
    room = null;
  }

  const BYE_TEXT: Partial<Record<ByeReason, string>> = {
    room_not_found: "Cette partie n'existe pas (ou plus).",
    expired: "Partie expirée après 2 h d'inactivité.",
    kicked: "L'organisateur t'a retiré du salon.",
    waiting_for_host: "L'organisateur n'est pas encore entré dans le salon. Réessaie dans un instant.",
  };
</script>

{#if askName}
  <main class="screen">
    <button class="link back" onclick={() => go('/')}>← Accueil</button>
    <h1 class="punk title">PARTIE {code}</h1>
    <form onsubmit={joinAsGuest}>
      <label class="field">
        Ton pseudo d'invité
        <input bind:value={name} maxlength="24" autocomplete="nickname" required />
      </label>
      <p class="hint">12 caractères maximum. Tu as un compte ? <a href="/connexion?suite=/p/{code}">Connecte-toi</a>.</p>
      {#if nameError}<p class="error" role="alert">{nameError}</p>{/if}
      <button class="big" type="submit">ENTRER</button>
    </form>
  </main>
{:else if room?.bye}
  <main class="screen center">
    <h1 class="punk title">OUPS</h1>
    <p class="msg">
      {BYE_TEXT[room.bye] ?? (room.lastError ? errorMessage(room.lastError) : 'Connexion fermée.')}
    </p>
    {#if room.bye === 'waiting_for_host'}
      <button class="big" onclick={retry}>RÉESSAYER</button>
    {/if}
    <button class="ghost" onclick={() => go('/')}>Retour à l'accueil</button>
  </main>
{:else if !room?.view}
  <main class="screen center">
    <p class="hint">Connexion à la partie {code}…</p>
  </main>
{:else}
  {#if room.status === 'offline'}
    <div class="offline" role="status">Connexion perdue, on se reconnecte…</div>
  {/if}
  {#if room.view.phase === 'lobby'}
    <Lobby {room} view={room.view} />
  {:else}
    <InGame {room} view={room.view} />
  {/if}
{/if}

<style>
  .back {
    align-self: flex-start;
    padding-left: 0;
  }
  .title {
    font-size: 40px;
    margin: 4px 0 8px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .center {
    justify-content: center;
    text-align: center;
  }
  .msg {
    font-size: 18px;
    font-weight: 700;
  }
  .offline {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 8px 12px;
    background: var(--pink);
    color: var(--ink);
    font-weight: 900;
    text-align: center;
  }
</style>
