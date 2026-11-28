<script lang="ts">
  // Un meme dessiné sur canvas (même rendu que l'image téléchargée).
  // En mode éditable : zones de texte sélectionnables et déplaçables au doigt.
  import type { TextLayer } from '../../shared/meme';
  import { drawMeme, fontsReady, loadPhoto, type LaidOutLayer } from '../lib/meme-render';

  let {
    photoId,
    layers,
    editable = false,
    selected = null,
    onselect,
    onmove,
  }: {
    photoId: string;
    layers: TextLayer[];
    editable?: boolean;
    selected?: number | null;
    onselect?: (index: number) => void;
    onmove?: (index: number, x: number, y: number) => void;
  } = $props();

  let width = $state(0);
  let canvas = $state<HTMLCanvasElement | null>(null);
  let photo = $state<HTMLImageElement | null>(null);
  let failed = $state(false);
  let fontsOk = $state(false);
  let boxes = $state<{ index: number; left: number; top: number; w: number; h: number }[]>([]);

  void fontsReady.then(() => (fontsOk = true));

  $effect(() => {
    const id = photoId;
    photo = null;
    failed = false;
    loadPhoto(id)
      .then((img) => {
        if (photoId === id) photo = img;
      })
      .catch(() => {
        if (photoId === id) failed = true;
      });
  });

  const ratio = $derived(photo ? photo.naturalHeight / photo.naturalWidth : 0.75);
  const height = $derived(Math.round(width * ratio));

  $effect(() => {
    const key = JSON.stringify(layers); // redessiner à chaque modification du texte
    void key;
    void fontsOk;
    if (!canvas || !width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(width * dpr);
    const H = Math.round(height * dpr);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const laid: LaidOutLayer[] = drawMeme(ctx, photo, layers, W, H);
    if (!editable) return;
    const drawn = new Map(laid.map((l) => [l.index, l]));
    boxes = layers.map((layer, index) => {
      const l = drawn.get(index);
      if (l) return { index, left: (l.cx - l.w / 2) / dpr, top: (l.cy - l.h / 2) / dpr, w: l.w / dpr, h: l.h / dpr };
      // Zone vide : un cadre à sa position pour pouvoir la toucher.
      const h = Math.max(28, layer.size * width * 1.3);
      const w = layer.style === 'snap' ? width : width * 0.7;
      return { index, left: layer.style === 'snap' ? 0 : layer.x * width - w / 2, top: layer.y * height - h / 2, w, h };
    });
  });

  let drag: { index: number; startX: number; startY: number; x0: number; y0: number; id: number } | null = null;

  function down(event: PointerEvent, index: number) {
    const layer = layers[index];
    if (!layer) return;
    onselect?.(index);
    drag = { index, startX: event.clientX, startY: event.clientY, x0: layer.x, y0: layer.y, id: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId || !width || !height) return;
    const x = Math.min(1, Math.max(0, drag.x0 + (event.clientX - drag.startX) / width));
    const y = Math.min(1, Math.max(0, drag.y0 + (event.clientY - drag.startY) / height));
    onmove?.(drag.index, x, y);
  }

  function up(event: PointerEvent) {
    if (drag?.id === event.pointerId) drag = null;
  }
</script>

<div class="meme" bind:clientWidth={width} style:height="{height}px">
  <canvas bind:this={canvas} style:width="{width}px" style:height="{height}px" aria-hidden="true"></canvas>
  {#if failed}<span class="missing">photo introuvable</span>{/if}
  {#if editable}
    {#each boxes as b (b.index)}
      <button
        type="button"
        class="hit"
        class:on={selected === b.index}
        style:left="{b.left}px"
        style:top="{b.top}px"
        style:width="{b.w}px"
        style:height="{b.h}px"
        aria-label="Zone de texte {b.index + 1}"
        onpointerdown={(e) => down(e, b.index)}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
      >
        {#if !layers[b.index]?.text.trim()}<span>Touche pour écrire</span>{/if}
      </button>
    {/each}
  {/if}
</div>

<style>
  .meme {
    position: relative;
    width: 100%;
    background-color: #3a3530;
    background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0 10px, transparent 10px 20px);
    overflow: hidden;
    touch-action: none;
  }
  canvas {
    display: block;
  }
  .missing {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-weight: 600;
    font-size: 13px;
    color: #b9b19f;
  }
  .hit {
    position: absolute;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: grab;
    touch-action: none;
    display: grid;
    place-items: center;
  }
  .hit.on {
    outline: 2px dashed var(--yellow);
    outline-offset: 2px;
  }
  .hit span {
    font-weight: 700;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    text-shadow: 1px 1px 0 #000;
  }
</style>
