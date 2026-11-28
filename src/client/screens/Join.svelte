<script lang="ts">
  import type { RoomInfo } from '../../shared/protocol';
  import { api } from '../lib/api';
  import { errorMessage } from '../lib/errors';
  import { go } from '../lib/router.svelte';
  import { hasDeviceToken } from '../lib/room.svelte';

  let code = $state('');
  let busy = $state(false);
  let err = $state<string | null>(null);

  function onInput() {
    code = code.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (code.length !== 5) {
      err = 'Le code fait 5 lettres.';
      return;
    }
    busy = true;
    err = null;
    try {
      const info = await api<RoomInfo>(`/api/rooms/${code}`);
      if (!info.exists) err = 'Aucune partie avec ce code (ou elle a expiré).';
      else if (info.phase !== 'lobby' && !hasDeviceToken(code)) err = errorMessage('game_started');
      else go(`/p/${code}`);
    } catch (e) {
      err = errorMessage(e);
    } finally {
      busy = false;
    }
  }
</script>

<main class="screen">
  <button class="link back" onclick={() => go('/')}>← Accueil</button>
  <h1 class="punk title">REJOINDRE</h1>
  <form onsubmit={submit}>
    <label class="field">
      Code de la partie
      <input
        class="code"
        bind:value={code}
        oninput={onInput}
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        placeholder="KXQBZ"
        maxlength="5"
        required
      />
    </label>
    {#if err}<p class="error" role="alert">{err}</p>{/if}
    <button class="big" type="submit" disabled={busy || code.length !== 5}>ENTRER</button>
  </form>
</main>

<style>
  .back {
    align-self: flex-start;
    padding-left: 0;
  }
  .title {
    font-size: 44px;
    margin: 4px 0 8px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .code {
    font-family: var(--bangers) !important;
    font-size: 40px !important;
    letter-spacing: 8px;
    text-align: center;
  }
  .code::placeholder {
    color: #c9c0aa;
  }
</style>
