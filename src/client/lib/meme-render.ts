/**
 * Rendu d'un meme (photo + zones de texte) sur un canvas.
 *
 * Le même code dessine l'aperçu de l'éditeur, les memes du vote et des résultats, et l'image
 * téléchargée : l'aperçu est donc exactement l'image finale (cahier des charges, Éditeur).
 * Toutes les dimensions sont proportionnelles à la largeur de l'image.
 */
import type { TextColor } from '../../shared/config';
import type { MemeRecipe, TextLayer } from '../../shared/meme';

export const TEXT_COLOR_HEX: Record<TextColor, string> = {
  white: '#ffffff',
  black: '#111111',
  yellow: '#ffe433',
  red: '#ff3b30',
  pink: '#ff4d8d',
  blue: '#3e8bff',
  green: '#3ddc84',
  orange: '#ff8a1f',
};

export const TEXT_COLOR_LABEL: Record<TextColor, string> = {
  white: 'Blanc',
  black: 'Noir',
  yellow: 'Jaune',
  red: 'Rouge',
  pink: 'Rose',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
};

/** Le bandeau Snap utilise un texte plus petit que le meme classique, à taille égale. */
const SNAP_SCALE = 0.62;

export interface LaidOutLayer {
  index: number;
  layer: TextLayer;
  lines: string[];
  font: string;
  fontPx: number;
  lineHeight: number;
  /** Boîte occupée, en pixels de l'image (centre et taille). */
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function fontFor(layer: TextLayer, W: number): { font: string; px: number } {
  if (layer.style === 'snap') {
    const px = Math.max(8, layer.size * W * SNAP_SCALE);
    return { font: `600 ${px}px Archivo, system-ui, sans-serif`, px };
  }
  const px = Math.max(8, layer.size * W);
  return { font: `${px}px Anton, Impact, sans-serif`, px };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Calcule où et comment chaque zone de texte sera dessinée (les zones vides sont ignorées). */
export function layoutMeme(ctx: CanvasRenderingContext2D, layers: TextLayer[], W: number, H: number): LaidOutLayer[] {
  const out: LaidOutLayer[] = [];
  layers.forEach((layer, index) => {
    const text = layer.style === 'classic' ? layer.text.toLocaleUpperCase('fr') : layer.text;
    if (!text.trim()) return;
    const { font, px } = fontFor(layer, W);
    ctx.font = font;
    if (layer.style === 'snap') {
      const padX = 0.035 * W;
      const padY = 0.022 * W;
      const lineHeight = px * 1.22;
      const lines = wrap(ctx, text, W - 2 * padX);
      const h = lines.length * lineHeight + 2 * padY;
      const cy = Math.min(H - h / 2, Math.max(h / 2, layer.y * H));
      out.push({ index, layer, lines, font, fontPx: px, lineHeight, cx: W / 2, cy, w: W, h });
    } else {
      const lineHeight = px * 1.05;
      const lines = wrap(ctx, text, 0.92 * W);
      const w = Math.min(0.92 * W, Math.max(...lines.map((l) => ctx.measureText(l).width)));
      const h = lines.length * lineHeight;
      const margin = 0.03 * W;
      const cx = Math.min(W - margin - w / 2, Math.max(margin + w / 2, layer.x * W));
      const cy = Math.min(H - h / 2, Math.max(h / 2, layer.y * H));
      out.push({ index, layer, lines, font, fontPx: px, lineHeight, cx, cy, w, h });
    }
  });
  return out;
}

/** Dessine la photo et le texte du meme sur tout le canvas. */
export function drawMeme(ctx: CanvasRenderingContext2D, photo: CanvasImageSource | null, layers: TextLayer[], W: number, H: number): LaidOutLayer[] {
  ctx.clearRect(0, 0, W, H);
  if (photo) {
    ctx.drawImage(photo, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#3a3530';
    ctx.fillRect(0, 0, W, H);
  }
  const laid = layoutMeme(ctx, layers, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const l of laid) {
    ctx.font = l.font;
    const color = TEXT_COLOR_HEX[l.layer.color];
    const top = l.cy - ((l.lines.length - 1) * l.lineHeight) / 2;
    if (l.layer.style === 'snap') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.62)';
      ctx.fillRect(0, l.cy - l.h / 2, W, l.h);
      ctx.fillStyle = color;
      l.lines.forEach((line, i) => ctx.fillText(line, l.cx, top + i * l.lineHeight));
      continue;
    }
    // Meme classique : contour épais + ombre dure, puis remplissage par-dessus.
    const outline = l.layer.color === 'black' ? '#ffffff' : '#000000';
    ctx.strokeStyle = outline;
    ctx.lineWidth = l.fontPx * 0.13;
    ctx.shadowColor = outline;
    ctx.shadowOffsetX = l.fontPx * 0.06;
    ctx.shadowOffsetY = l.fontPx * 0.06;
    ctx.shadowBlur = 0;
    l.lines.forEach((line, i) => ctx.strokeText(line, l.cx, top + i * l.lineHeight));
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = color;
    l.lines.forEach((line, i) => ctx.fillText(line, l.cx, top + i * l.lineHeight));
  }
  return laid;
}

// ---------------------------------------------------------------------------------------------
// Photos et polices
// ---------------------------------------------------------------------------------------------

const photoCache = new Map<string, Promise<HTMLImageElement>>();

export const photoUrl = (id: string, kind: 'full' | 'thumb' = 'full') => `/api/photos/${id}/${kind}`;

export function loadPhoto(id: string): Promise<HTMLImageElement> {
  let pending = photoCache.get(id);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => {
        photoCache.delete(id);
        reject(new Error('photo_unavailable'));
      };
      img.src = photoUrl(id);
    });
    photoCache.set(id, pending);
  }
  return pending;
}

/** À appeler avant de mesurer du texte : sinon le canvas mesure avec une police de repli. */
export const fontsReady: Promise<unknown> =
  typeof document === 'undefined'
    ? Promise.resolve()
    : Promise.all([document.fonts.load('40px Anton'), document.fonts.load('600 40px Archivo')]).catch(() => undefined);

/** Image finale du meme, à la taille de la photo (1600 px max), pour le téléchargement. */
export async function renderMemeBlob(recipe: MemeRecipe): Promise<Blob> {
  const [photo] = await Promise.all([loadPhoto(recipe.photoId), fontsReady]);
  const canvas = document.createElement('canvas');
  canvas.width = photo.naturalWidth;
  canvas.height = photo.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  drawMeme(ctx, photo, recipe.layers, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/jpeg', 0.92),
  );
}

export async function downloadMeme(recipe: MemeRecipe, filename: string): Promise<void> {
  const blob = await renderMemeBlob(recipe);
  const file = new File([blob], filename, { type: 'image/jpeg' });
  // Sur téléphone, le partage natif permet d'enregistrer dans la galerie.
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // partage annulé : téléchargement classique
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function vibrate(ms = 15): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // non disponible
  }
}
