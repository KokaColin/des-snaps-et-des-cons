<script lang="ts">
  import { MEMBER_NAMES, type MemberName } from '../../shared/config';
  import type { PhotoInfo, PhotosResponse } from '../../shared/protocol';
  import type { PhotoCategory } from '../../shared/types';
  import PhotoViewer from '../components/PhotoViewer.svelte';
  import { api, ApiError } from '../lib/api';
  import { errorMessage } from '../lib/errors';
  import { prepareImage } from '../lib/images';
  import { go } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { makeZip, type ZipEntry } from '../lib/zip';

  type Tab = PhotoCategory | 'trash';

  let photos = $state<PhotoInfo[]>([]);
  let trashDays = $state(30);
  let loading = $state(true);
  let err = $state<string | null>(null);
  let tab = $state<Tab>('iconic');
  let author = $state<MemberName | ''>('');
  let newestFirst = $state(true);
  let viewerId = $state<string | null>(null);

  // Envoi
  let fileInput = $state<HTMLInputElement | null>(null);
  let pending = $state<File[]>([]);
  let uploadCategory = $state<PhotoCategory>('iconic');
  let upload = $state<{ total: number; done: number; failed: { name: string; reason: string }[]; running: boolean } | null>(null);

  // Export
  let exporting = $state<{ done: number; total: number } | null>(null);

  $effect(() => {
    if (session.loaded && !session.member) go('/connexion?suite=/photos', true);
  });

  $effect(() => {
    if (session.member) void load();
  });

  async function load() {
    loading = true;
    try {
      const res = await api<PhotosResponse>('/api/photos');
      photos = res.photos;
      trashDays = res.trashDays;
      err = null;
    } catch (e) {
      err = errorMessage(e);
    } finally {
      loading = false;
    }
  }

  const counts = $derived({
    iconic: photos.filter((p) => p.deletedAt === null && p.category === 'iconic').length,
    fauto: photos.filter((p) => p.deletedAt === null && p.category === 'fauto').length,
    trash: photos.filter((p) => p.deletedAt !== null).length,
  });

  const shown = $derived(
    photos
      .filter((p) => (tab === 'trash' ? p.deletedAt !== null : p.deletedAt === null && p.category === tab))
      .filter((p) => !author || p.author === author)
      .sort((a, b) => (newestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)),
  );

  function replace(photo: PhotoInfo) {
    photos = photos.map((p) => (p.id === photo.id ? photo : p));
  }

  function pickFiles() {
    fileInput?.click();
  }

  function onFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    pending = [...(input.files ?? [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    uploadCategory = tab === 'fauto' ? 'fauto' : 'iconic';
    input.value = '';
  }

  async function startUpload() {
    const files = pending;
    pending = [];
    const state = { total: files.length, done: 0, failed: [] as { name: string; reason: string }[], running: true };
    upload = state;
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const file = files[next++] as File;
        try {
          const img = await prepareImage(file);
          const form = new FormData();
          form.set('category', uploadCategory);
          form.set('sourceHash', img.sourceHash);
          form.set('width', String(img.width));
          form.set('height', String(img.height));
          form.set('full', img.full, 'photo');
          form.set('thumb', img.thumb, 'miniature');
          const res = await api<{ photo: PhotoInfo }>('/api/photos', { method: 'POST', body: form });
          photos = [res.photo, ...photos];
        } catch (e) {
          let reason = errorMessage(e instanceof Error && !(e instanceof ApiError) ? e.message : e);
          if (e instanceof ApiError && e.code === 'duplicate' && e.data.inTrash) reason = 'Déjà dans la corbeille.';
          state.failed.push({ name: file.name, reason });
        }
        state.done += 1;
        upload = { ...state };
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    upload = { ...state, running: false };
    if (uploadCategory !== tab && tab !== 'trash') tab = uploadCategory;
  }

  async function exportZip() {
    const active = photos.filter((p) => p.deletedAt === null);
    exporting = { done: 0, total: active.length };
    try {
      const entries: ZipEntry[] = [];
      for (const p of active) {
        const res = await fetch(`/api/photos/${p.id}/full`);
        if (!res.ok) throw new Error('server_error');
        const ext = res.headers.get('Content-Type') === 'image/jpeg' ? 'jpg' : 'webp';
        const folder = p.category === 'fauto' ? 'fauto' : 'iconiques';
        const date = new Date(p.createdAt);
        entries.push({ name: `${folder}/${date.toISOString().slice(0, 10)}-${p.author}-${p.id}.${ext}`, data: new Uint8Array(await res.arrayBuffer()), date });
        exporting = { done: entries.length, total: active.length };
      }
      const manifest = active.map(({ id, category, author, createdAt, uses, lastPlayedAt }) => ({
        id,
        category,
        author,
        createdAt: new Date(createdAt).toISOString(),
        uses,
        lastPlayedAt: lastPlayedAt ? new Date(lastPlayedAt).toISOString() : null,
      }));
      entries.push({ name: 'photos.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
      const url = URL.createObjectURL(makeZip(entries));
      const a = document.createElement('a');
      a.href = url;
      a.download = `phototheque-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      err = errorMessage(e instanceof Error ? e.message : e);
    } finally {
      exporting = null;
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'iconic', label: 'Iconiques' },
    { id: 'fauto', label: 'Fauto' },
    { id: 'trash', label: 'Corbeille' },
  ];
</script>

<main class="screen wide">
  <div class="head">
    <button class="link back" onclick={() => go('/')}>← Accueil</button>
    <h1 class="punk title">PHOTOTHÈQUE</h1>
  </div>

  <div class="tabs" role="tablist">
    {#each TABS as t (t.id)}
      <button class="ghost" class:selected={tab === t.id} role="tab" aria-selected={tab === t.id} onclick={() => (tab = t.id)}>
        {t.label} <span class="n">{counts[t.id]}</span>
      </button>
    {/each}
  </div>

  <div class="tools">
    <label class="field inline">
      <span class="sr-only">Membre</span>
      <select bind:value={author}>
        <option value="">Tous les membres</option>
        {#each MEMBER_NAMES as m (m)}<option value={m}>{m}</option>{/each}
      </select>
    </label>
    <button class="ghost" onclick={() => (newestFirst = !newestFirst)}>{newestFirst ? 'Plus récentes' : 'Plus anciennes'}</button>
    <span class="spacer"></span>
    <button class="ghost" onclick={exportZip} disabled={!!exporting || counts.iconic + counts.fauto === 0}>
      {exporting ? `Export ${exporting.done}/${exporting.total}` : 'Exporter (zip)'}
    </button>
    {#if tab !== 'trash'}
      <button class="big add" onclick={pickFiles} disabled={upload?.running}>+ PHOTOS</button>
    {/if}
    <input bind:this={fileInput} type="file" accept="image/*" multiple hidden onchange={onFiles} />
  </div>

  {#if tab === 'fauto'}
    <p class="hint">Les « screen random » : ce que la Fauto impose à un adversaire.</p>
  {:else if tab === 'trash'}
    <p class="hint">Restaurable par tous pendant {trashDays} jours, puis effacé (sauf photo d'un meme légendaire).</p>
  {/if}

  {#if upload}
    <div class="upload taped" role="status">
      <strong>{upload.running ? `Envoi ${upload.done}/${upload.total}…` : `${upload.total - upload.failed.length}/${upload.total} photo(s) ajoutée(s)`}</strong>
      {#each upload.failed as f (f.name)}
        <span class="fail">{f.name} : {f.reason}</span>
      {/each}
      {#if !upload.running}<button class="link" onclick={() => (upload = null)}>OK</button>{/if}
    </div>
  {/if}

  {#if err}<p class="error" role="alert">{err}</p>{/if}

  {#if loading}
    <p class="hint">Chargement…</p>
  {:else if shown.length === 0}
    <p class="empty">{tab === 'trash' ? 'Corbeille vide.' : 'Aucune photo ici pour l’instant.'}</p>
  {:else}
    <ul class="grid">
      {#each shown as p (p.id)}
        <li>
          <button class="thumb" onclick={() => (viewerId = p.id)} aria-label="Photo de {p.author}">
            <img src="/api/photos/{p.id}/thumb" alt="" loading="lazy" decoding="async" />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

{#if pending.length > 0}
  <div class="sheet-backdrop" role="presentation" onclick={() => (pending = [])}></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label="Catégorie des photos">
    <h2 class="punk">{pending.length} PHOTO{pending.length > 1 ? 'S' : ''}</h2>
    <p class="hint">Où les ranger ? (modifiable ensuite)</p>
    <div class="choices">
      <button class="ghost" class:selected={uploadCategory === 'iconic'} onclick={() => (uploadCategory = 'iconic')}>
        Iconique<small>tirée en partie</small>
      </button>
      <button class="ghost" class:selected={uploadCategory === 'fauto'} onclick={() => (uploadCategory = 'fauto')}>
        Screen random<small>pour la Fauto</small>
      </button>
    </div>
    <button class="big" onclick={startUpload}>ENVOYER</button>
    <button class="link" onclick={() => (pending = [])}>Annuler</button>
  </div>
{/if}

{#if viewerId}
  <PhotoViewer
    list={shown}
    id={viewerId}
    {trashDays}
    onclose={() => (viewerId = null)}
    onchange={replace}
    onnavigate={(id) => (viewerId = id)}
  />
{/if}

<style>
  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .back {
    align-self: flex-start;
    padding-left: 0;
  }
  .title {
    font-size: 44px;
  }
  .tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tabs .ghost {
    flex: 1;
    min-width: 0;
  }
  .n {
    font-family: var(--bangers);
    letter-spacing: 1px;
    margin-left: 4px;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .field.inline select {
    min-height: 48px;
    font-size: 15px;
  }
  .spacer {
    flex: 1;
  }
  .add {
    width: auto;
    min-height: 50px;
    font-size: 24px;
  }
  .upload {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
  }
  .fail {
    color: var(--ko);
    font-weight: 700;
    overflow-wrap: anywhere;
  }
  .empty {
    margin: 30px 0;
    text-align: center;
    color: var(--text-3);
    font-weight: 700;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 6px;
  }
  .thumb {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    background: var(--band);
    cursor: pointer;
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb:focus-visible {
    outline: 3px solid var(--yellow);
    outline-offset: 2px;
  }
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 20;
  }
  .sheet {
    position: fixed;
    left: 50%;
    bottom: 0;
    z-index: 21;
    width: min(100%, 480px);
    transform: translateX(-50%);
    padding: 20px 16px max(20px, env(safe-area-inset-bottom));
    background: var(--bg);
    border-top: 3px solid var(--yellow);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sheet h2 {
    font-size: 34px;
  }
  .choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .choices .ghost {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 64px;
  }
  .choices small {
    font-weight: 500;
    font-size: 12px;
    opacity: 0.8;
  }
</style>
