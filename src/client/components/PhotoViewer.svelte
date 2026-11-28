<script lang="ts">
  // Plein écran d'une photo : infos, changement de catégorie, corbeille / restauration.
  import type { PhotoInfo } from '../../shared/protocol';
  import { api } from '../lib/api';
  import { errorMessage } from '../lib/errors';

  let {
    list,
    id,
    trashDays,
    onclose,
    onchange,
    onnavigate,
  }: {
    list: PhotoInfo[];
    id: string;
    trashDays: number;
    onclose: () => void;
    onchange: (photo: PhotoInfo) => void;
    onnavigate: (id: string) => void;
  } = $props();

  let busy = $state(false);
  let err = $state<string | null>(null);

  const index = $derived(list.findIndex((p) => p.id === id));
  const photo = $derived(list[index] ?? null);
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  $effect(() => {
    // La photo n'est plus dans la liste affichée (déplacée, supprimée) : on ferme.
    if (!photo) onclose();
  });

  function move(delta: number) {
    const next = list[index + delta];
    if (next) {
      err = null;
      onnavigate(next.id);
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') onclose();
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  }

  async function run(request: () => Promise<{ photo: PhotoInfo }>) {
    busy = true;
    err = null;
    try {
      const nextId = (list[index + 1] ?? list[index - 1])?.id ?? null;
      const { photo: updated } = await request();
      onchange(updated);
      if (nextId) onnavigate(nextId);
    } catch (e) {
      err = errorMessage(e);
    } finally {
      busy = false;
    }
  }

  const setCategory = (category: string) =>
    run(() => api(`/api/photos/${id}`, { method: 'PATCH', json: { category } }));
  const trash = () => run(() => api(`/api/photos/${id}`, { method: 'DELETE' }));
  const restore = () => run(() => api(`/api/photos/${id}/restore`, { method: 'POST', json: {} }));

  const daysLeft = $derived(
    photo?.deletedAt ? Math.max(0, Math.ceil((photo.deletedAt + trashDays * 86_400_000 - Date.now()) / 86_400_000)) : 0,
  );
</script>

<svelte:window onkeydown={onKey} />

{#if photo}
  <div class="viewer" role="dialog" aria-modal="true" aria-label="Photo">
    <button class="close" onclick={onclose} aria-label="Fermer">×</button>
    <div class="stage">
      <button class="nav prev" onclick={() => move(-1)} disabled={index <= 0} aria-label="Photo précédente">‹</button>
      {#key photo.id}
        <img src="/api/photos/{photo.id}/full" alt="Photo de {photo.author}" width={photo.width} height={photo.height} />
      {/key}
      <button class="nav next" onclick={() => move(1)} disabled={index >= list.length - 1} aria-label="Photo suivante">›</button>
    </div>
    <div class="info">
      <p>
        <strong>{photo.author}</strong> · {dateFmt.format(photo.createdAt)} · {photo.category === 'fauto' ? 'Fauto' : 'Iconique'}
        · jouée {photo.uses} fois{photo.lastPlayedAt ? ` (dernière : ${dateFmt.format(photo.lastPlayedAt)})` : ''}
      </p>
      {#if photo.deletedAt}
        <p class="hint">
          Supprimée par {photo.deletedBy} le {dateFmt.format(photo.deletedAt)} · effacée dans {daysLeft} jour{daysLeft > 1 ? 's' : ''}
        </p>
      {/if}
      {#if err}<p class="error" role="alert">{err}</p>{/if}
      <div class="actions">
        {#if photo.deletedAt}
          <button class="ghost" onclick={restore} disabled={busy}>Restaurer</button>
        {:else}
          <button class="ghost" onclick={() => setCategory(photo.category === 'fauto' ? 'iconic' : 'fauto')} disabled={busy}>
            Passer en {photo.category === 'fauto' ? 'Iconique' : 'Fauto'}
          </button>
          <button class="ghost danger" onclick={trash} disabled={busy}>Mettre à la corbeille</button>
        {/if}
      </div>
      <p class="hint">{index + 1}/{list.length}</p>
    </div>
  </div>
{/if}

<style>
  .viewer {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    background: rgba(10, 9, 12, 0.96);
  }
  .close {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    right: 8px;
    z-index: 2;
    width: 48px;
    height: 48px;
    border: 0;
    background: var(--paper);
    color: var(--ink);
    font-size: 30px;
    line-height: 1;
    box-shadow: 3px 3px 0 #000;
    cursor: pointer;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 64px 8px 8px;
  }
  img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    background: var(--band);
  }
  .nav {
    position: absolute;
    top: 50%;
    width: 44px;
    height: 64px;
    margin-top: -32px;
    border: 0;
    background: rgba(23, 22, 27, 0.7);
    color: var(--paper);
    font-size: 36px;
    cursor: pointer;
  }
  .nav:disabled {
    opacity: 0.2;
  }
  .prev {
    left: 4px;
  }
  .next {
    right: 4px;
  }
  .info {
    padding: 12px 16px max(16px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
  .info p {
    margin: 0;
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .actions .ghost {
    flex: 1;
  }
  .danger {
    box-shadow: 3px 3px 0 var(--pink);
  }
</style>
