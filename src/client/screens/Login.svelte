<script lang="ts">
  import type { MemberName } from '../../shared/config';
  import { PASSWORD_MIN_LENGTH } from '../../shared/protocol';
  import { colorFor, initial } from '../lib/colors';
  import { errorMessage } from '../lib/errors';
  import { ApiError } from '../lib/api';
  import { go, route, safeNext } from '../lib/router.svelte';
  import { login, refreshSession, session } from '../lib/session.svelte';

  let selected = $state<MemberName | null>(null);
  let password = $state('');
  let confirm = $state('');
  let busy = $state(false);
  let err = $state<string | null>(null);

  const account = $derived(session.accounts.find((a) => a.name === selected));
  const firstTime = $derived(account ? !account.hasPassword : false);
  const next = $derived(safeNext(new URLSearchParams(route.search).get('suite')));

  $effect(() => {
    if (session.member) go(next, true);
  });

  function pick(name: MemberName) {
    selected = name;
    password = '';
    confirm = '';
    err = null;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!selected) return;
    err = null;
    if (password.length < PASSWORD_MIN_LENGTH) {
      err = errorMessage('invalid_password');
      return;
    }
    if (firstTime && password !== confirm) {
      err = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    busy = true;
    try {
      await login(selected, password, firstTime);
      go(next, true);
    } catch (e) {
      err = errorMessage(e);
      if (e instanceof ApiError && e.code === 'account_not_created') await refreshSession();
      if (e instanceof ApiError && e.code === 'too_many_attempts' && typeof e.data.retryAfterS === 'number') {
        err = `Trop de tentatives. Réessaie dans ${Math.ceil(e.data.retryAfterS / 60)} min.`;
      }
    } finally {
      busy = false;
    }
  }
</script>

<main class="screen">
  <button class="link back" onclick={() => go('/')}>← Accueil</button>
  <h1 class="punk title">C'EST QUI ?</h1>

  <div class="names">
    {#each session.accounts as a (a.name)}
      <button class="name" class:on={selected === a.name} onclick={() => pick(a.name)} aria-pressed={selected === a.name}>
        <span class="av" style:background={colorFor(a.name)}>{initial(a.name)}</span>
        <span class="label">{a.name}</span>
      </button>
    {/each}
  </div>

  {#if selected}
    <form onsubmit={submit}>
      {#if firstTime}
        <p class="hint">
          Première connexion de {selected} : choisis ton mot de passe ({PASSWORD_MIN_LENGTH} caractères minimum). Il
          servira sur tous tes appareils.
        </p>
      {/if}
      <label class="field">
        Mot de passe
        <input
          type="password"
          bind:value={password}
          autocomplete={firstTime ? 'new-password' : 'current-password'}
          minlength={PASSWORD_MIN_LENGTH}
          required
        />
      </label>
      {#if firstTime}
        <label class="field">
          Encore une fois
          <input type="password" bind:value={confirm} autocomplete="new-password" required />
        </label>
      {/if}
      {#if err}<p class="error" role="alert">{err}</p>{/if}
      <button class="big" type="submit" disabled={busy}>{busy ? '…' : firstTime ? 'CRÉER MON COMPTE' : "C'EST MOI"}</button>
      <p class="hint">Mot de passe oublié ? Le mainteneur peut réinitialiser ton compte.</p>
    </form>
  {/if}
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
  .names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 6px 10px;
    border: 0;
    background: var(--paper);
    color: var(--ink);
    font-weight: 900;
    font-size: 17px;
    text-align: left;
    box-shadow: 3px 3px 0 #000;
    cursor: pointer;
  }
  .name:nth-child(odd) {
    transform: rotate(-0.6deg);
  }
  .name:nth-child(even) {
    transform: rotate(0.5deg);
  }
  .name.on {
    outline: 3px solid var(--yellow);
    outline-offset: 2px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 10px;
  }
</style>
