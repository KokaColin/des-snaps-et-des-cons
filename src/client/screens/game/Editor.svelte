<script lang="ts">
  import { untrack } from 'svelte';
  import { TEXT_COLORS, TEXT_STYLES } from '../../../shared/config';
  import { defaultLayers, type TextLayer } from '../../../shared/meme';
  import type { GameView } from '../../../shared/view';
  import GameHeader from '../../components/GameHeader.svelte';
  import MemeCanvas from '../../components/MemeCanvas.svelte';
  import { errorMessage } from '../../lib/errors';
  import { TEXT_COLOR_HEX, TEXT_COLOR_LABEL, vibrate } from '../../lib/meme-render';
  import type { Room } from '../../lib/room.svelte';

  let { room, view }: { room: Room; view: GameView } = $props();

  const MAX_LAYERS = 3;
  const MAX_TEXT = 120;
  const STYLE_LABEL = { classic: 'Classique', snap: 'Bandeau Snap' } as const;

  const creation = $derived(view.creation!);
  const assignment = $derived(creation.assignment);
  // Brouillon du serveur au montage (retour après déconnexion), sinon le modèle haut/bas.
  let layers = $state<TextLayer[]>(untrack(() => $state.snapshot(view.creation?.draft ?? defaultLayers()) as TextLayer[]));
  let selected = $state<number | null>(0);
  let input = $state<HTMLInputElement | null>(null);

  const current = $derived(selected !== null ? layers[selected] : undefined);
  const submittedCount = $derived(view.players.filter((p) => p.done).length);
  const sender = $derived(assignment.imposedBy ? view.players.find((p) => p.id === assignment.imposedBy)?.name : null);

  // Brouillon envoyé au serveur au fil de l'eau : à la fin du chrono, le meme part tel quel.
  let first = true;
  $effect(() => {
    const snapshot = JSON.stringify(layers);
    if (first) {
      first = false;
      return;
    }
    const timer = setTimeout(() => room.send({ type: 'draft', layers: JSON.parse(snapshot) }), 600);
    return () => clearTimeout(timer);
  });

  function update(patch: Partial<TextLayer>) {
    const layer = selected === null ? undefined : layers[selected];
    if (selected === null || !layer) return;
    layers[selected] = { ...layer, ...patch };
  }

  function addLayer() {
    if (layers.length >= MAX_LAYERS) return;
    layers.push({ text: '', x: 0.5, y: 0.5, size: 0.09, style: current?.style ?? 'classic', color: current?.color ?? 'white' });
    selected = layers.length - 1;
    queueMicrotask(() => input?.focus());
  }

  function removeLayer() {
    if (selected === null) return;
    layers.splice(selected, 1);
    selected = layers.length > 0 ? 0 : null;
  }

  function resize(delta: number) {
    if (!current) return;
    update({ size: Math.round(Math.min(0.25, Math.max(0.03, current.size + delta)) * 100) / 100 });
  }

  function submit() {
    vibrate();
    room.send({ type: 'submit', layers: $state.snapshot(layers) });
  }
</script>

{#if creation.submitted}
  <main class="screen">
    <GameHeader {view} {room} info="{submittedCount}/{view.players.length} ont validé">
      {#snippet title()}MANCHE {view.round}<small>/{view.totalRounds}</small>{/snippet}
    </GameHeader>
    <h2 class="punk sent">MEME ENVOYÉ !</h2>
    <div class="pola small" style:transform="rotate(1deg)">
      <MemeCanvas photoId={assignment.photoId} layers={creation.draft ?? layers} />
    </div>
    <p class="hint center">On attend les autres…</p>
    <ul class="waiting">
      {#each view.players as p (p.id)}
        <li class:done={p.done}>
          {p.name}{p.id === view.me ? ' (toi)' : ''}
          {#if p.absent}<span class="stamp ko">ABSENT</span>{:else if p.done}<span class="stamp ok">VALIDÉ</span>{/if}
        </li>
      {/each}
    </ul>
  </main>
{:else}
  <main class="screen editor">
    <GameHeader {view} {room} info="{submittedCount}/{view.players.length} ont validé">
      {#snippet title()}MANCHE {view.round}<small>/{view.totalRounds}</small>{/snippet}
    </GameHeader>

    {#if sender}
      <p class="fauto-in">{sender} t'a envoyé une Fauto !</p>
    {/if}

    <div class="pola">
      <span class="tape" aria-hidden="true"></span>
      <MemeCanvas
        photoId={assignment.photoId}
        {layers}
        editable
        {selected}
        onselect={(i) => (selected = i)}
        onmove={(i, x, y) => {
          if (layers[i]) layers[i] = { ...layers[i], x, y };
        }}
      />
    </div>

    {#if current}
      <label class="field">
        <span class="label">Texte sélectionné <small>(fais glisser la zone sur la photo pour la placer)</small></span>
        <input
          bind:this={input}
          value={current.text}
          oninput={(e) => update({ text: e.currentTarget.value.slice(0, MAX_TEXT) })}
          maxlength={MAX_TEXT}
          placeholder="Écris ta légende"
          enterkeyhint="done"
          autocomplete="off"
        />
      </label>

      <div class="tools">
        {#each TEXT_STYLES as s (s)}
          <button class="tool" class:on={current.style === s} onclick={() => update({ style: s })}>{STYLE_LABEL[s]}</button>
        {/each}
        <button class="tool" onclick={() => resize(-0.01)} aria-label="Texte plus petit">A−</button>
        <button class="tool" onclick={() => resize(0.01)} aria-label="Texte plus grand">A+</button>
      </div>

      <div class="colors" role="group" aria-label="Couleur du texte">
        {#each TEXT_COLORS as c (c)}
          <button
            class="sw"
            class:on={current.color === c}
            class:dark={c === 'black'}
            style:background={TEXT_COLOR_HEX[c]}
            onclick={() => update({ color: c })}
            aria-label={TEXT_COLOR_LABEL[c]}
            aria-pressed={current.color === c}
          ></button>
        {/each}
      </div>
    {:else}
      <p class="hint">Touche une zone de texte sur la photo, ou ajoute-en une.</p>
    {/if}

    <div class="tools">
      <button class="tool grow" onclick={addLayer} disabled={layers.length >= MAX_LAYERS}>
        + Texte <span class="thin">({layers.length}/{MAX_LAYERS})</span>
      </button>
      {#if current}
        <button class="tool" onclick={removeLayer} aria-label="Supprimer la zone">Suppr.</button>
      {/if}
      <button
        class="tool grow"
        onclick={() => room.send({ type: 'reroll' })}
        disabled={assignment.rerolled || assignment.imposedBy !== null}
        title={assignment.imposedBy ? 'Une Fauto ne se change pas' : ''}
      >
        Changer d'image <span class="thin">({assignment.rerolled || assignment.imposedBy ? 0 : 1})</span>
      </button>
    </div>

    {#if room.lastError}<p class="error" role="alert">{errorMessage(room.lastError)}</p>{/if}

    <button class="big pink submit" onclick={submit}>Valider mon meme</button>
  </main>
{/if}

<style>
  .editor {
    gap: 14px;
  }
  .pola {
    position: relative;
    align-self: center;
    width: min(100%, 360px);
    padding: 10px 10px 12px;
    background: var(--paper);
    transform: rotate(-1deg);
    box-shadow: 5px 5px 0 #000;
  }
  .pola.small {
    width: min(70%, 260px);
  }
  .tape {
    position: absolute;
    z-index: 1;
    top: -12px;
    left: 18px;
    width: 70px;
    height: 22px;
    background: var(--tape);
    transform: rotate(-8deg);
  }
  .fauto-in {
    align-self: center;
    margin: 0;
    padding: 4px 12px;
    background: var(--yellow);
    color: var(--ink);
    font-family: var(--bangers);
    font-size: 20px;
    letter-spacing: 1px;
    transform: rotate(-2deg);
    box-shadow: 3px 3px 0 #000;
  }
  .label small {
    font-weight: 500;
    color: var(--text-3);
  }
  .field input {
    min-height: 46px;
    font-size: 16px;
  }
  .tools {
    display: flex;
    gap: 8px;
  }
  .tool {
    min-height: 44px;
    padding: 0 12px;
    border: 2px solid var(--paper);
    background: transparent;
    color: var(--paper);
    font: 700 14px var(--archivo);
    cursor: pointer;
  }
  .tool.grow {
    flex: 1;
  }
  .tools .tool:not(.grow):first-child,
  .tools .tool:not(.grow):nth-child(2) {
    flex: 1;
  }
  .tool.on {
    background: var(--paper);
    color: var(--ink);
  }
  .tool:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .thin {
    font-weight: 400;
  }
  .colors {
    display: flex;
    justify-content: space-between;
  }
  .sw {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
  }
  .sw.dark {
    border: 2px solid var(--paper);
  }
  .sw.on {
    box-shadow: 0 0 0 3px var(--yellow);
  }
  .submit {
    margin-top: auto;
  }
  .sent {
    align-self: center;
    font-size: 40px;
    margin: 10px 0;
  }
  .center {
    text-align: center;
  }
  .waiting {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .waiting li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    color: var(--text-3);
  }
  .waiting li.done {
    color: var(--paper);
  }
  .ok {
    color: #6fdc7a;
  }
  .ko {
    color: var(--pink);
  }
</style>
