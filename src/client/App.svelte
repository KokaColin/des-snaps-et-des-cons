<script lang="ts">
  // Page d'attente du lot 1 : prouve que le site et l'API sont en ligne.
  let status = $state<'checking' | 'online' | 'offline'>('checking');

  $effect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(() => (status = 'online'))
      .catch(() => (status = 'offline'));
  });

  const letters = 'DES SNAPS & DES CONS'.split('');
</script>

<main>
  <h1 aria-label="Des Snaps et des Cons">
    {#each letters as letter, i}
      {#if letter === ' '}
        <span class="space"></span>
      {:else}
        <span class="cut" style:--r="{((i * 37) % 9) - 4}deg">{letter}</span>
      {/if}
    {/each}
  </h1>
  <p class="tape">Chantier en cours</p>
  <p class="status" data-status={status}>
    {#if status === 'checking'}Connexion au serveur…{/if}
    {#if status === 'online'}Serveur en ligne{/if}
    {#if status === 'offline'}Serveur injoignable{/if}
  </p>
</main>

<style>
  :global(html, body) {
    margin: 0;
    min-height: 100%;
    background: #16161a;
    color: #f3ecdc;
    font-family: system-ui, sans-serif;
  }
  main {
    min-height: 100dvh;
    display: grid;
    place-content: center;
    gap: 1.5rem;
    padding: 1.5rem;
    text-align: center;
  }
  h1 {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
    margin: 0;
    font-size: clamp(2rem, 9vw, 4rem);
    line-height: 1;
  }
  .cut {
    display: inline-block;
    padding: 0.15em 0.2em;
    background: #f3ecdc;
    color: #16161a;
    font-weight: 900;
    transform: rotate(var(--r));
    box-shadow: 3px 3px 0 #000;
  }
  .space {
    width: 0.6em;
  }
  .tape {
    justify-self: center;
    margin: 0;
    padding: 0.4rem 1.2rem;
    background: rgba(255, 214, 102, 0.85);
    color: #16161a;
    font-weight: 700;
    transform: rotate(-3deg);
  }
  .status {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.7;
  }
  .status[data-status='online'] {
    color: #8fe3a1;
    opacity: 1;
  }
</style>
