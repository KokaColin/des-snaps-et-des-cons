<script lang="ts">
  import Logo from '../components/Logo.svelte';
  import { api } from '../lib/api';
  import { errorMessage } from '../lib/errors';
  import { go } from '../lib/router.svelte';
  import { logout, session } from '../lib/session.svelte';

  let creating = $state(false);
  let err = $state<string | null>(null);

  async function create() {
    creating = true;
    err = null;
    try {
      const { code } = await api<{ code: string }>('/api/rooms', { method: 'POST', json: {} });
      go(`/p/${code}`);
    } catch (e) {
      err = errorMessage(e);
    } finally {
      creating = false;
    }
  }

  async function signOut() {
    try {
      await logout();
    } catch (e) {
      err = errorMessage(e);
    }
  }
</script>

<main class="screen">
  <div class="top"><Logo /></div>

  {#if !session.loaded}
    <p class="hint center">Connexion au serveur…</p>
  {:else}
    {#if session.offline}
      <p class="error">Serveur injoignable. Vérifie ta connexion.</p>
    {/if}

    {#if session.member}
      <p class="hello">Salut <strong>{session.member}</strong> !</p>
      <div class="actions">
        <button class="big" onclick={create} disabled={creating}>{creating ? 'CRÉATION…' : 'CRÉER UNE PARTIE'}</button>
        <button class="ghost" onclick={() => go('/rejoindre')}>Rejoindre avec un code</button>
        <button class="ghost" onclick={() => go('/photos')}>Photothèque</button>
      </div>
      <button class="link" onclick={signOut}>Se déconnecter</button>
    {:else}
      <div class="actions">
        <button class="big" onclick={() => go('/rejoindre')}>REJOINDRE UNE PARTIE</button>
        <button class="ghost" onclick={() => go('/connexion')}>Je suis du Groupe des 7</button>
      </div>
      <p class="hint center">Invité ? Demande le code ou le lien à un membre.</p>
    {/if}

    {#if err}<p class="error" role="alert">{err}</p>{/if}
  {/if}
</main>

<style>
  .top {
    display: flex;
    justify-content: center;
    margin: 24px 0 28px;
  }
  .hello {
    margin: 0;
    text-align: center;
    font-size: 18px;
  }
  .hello strong {
    font-weight: 900;
    color: var(--yellow);
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 8px;
  }
  .center {
    text-align: center;
  }
</style>
