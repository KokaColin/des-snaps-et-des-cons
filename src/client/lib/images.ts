/**
 * Préparation des photos dans le navigateur, avant envoi : photo 1600 px et miniature 400 px,
 * en WebP (JPEG si le navigateur ne sait pas encoder le WebP, comme certains Safari).
 * L'empreinte SHA-256 du fichier d'origine sert à refuser les doublons exacts.
 */
import { MAX_PHOTO_BYTES, MAX_THUMB_BYTES, PHOTO_MAX_SIDE, THUMB_MAX_SIDE } from '../../shared/protocol';

export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  sourceHash: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const sourceHash = await sha256Hex(await file.arrayBuffer());
  const source = await decode(file);
  const fullCanvas = drawScaled(source, PHOTO_MAX_SIDE);
  if ('close' in source) source.close();
  const full = await encodeUnder(fullCanvas, [0.82, 0.72, 0.6, 0.45], MAX_PHOTO_BYTES);
  const thumbCanvas = drawScaled(fullCanvas, THUMB_MAX_SIDE);
  const thumb = await encodeUnder(thumbCanvas, [0.72, 0.55, 0.4], MAX_THUMB_BYTES);
  return { full, thumb, width: fullCanvas.width, height: fullCanvas.height, sourceHash };
}

type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Repli : l'élément <img> applique lui aussi l'orientation EXIF.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error('invalid_image');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function sizeOf(source: Source): { w: number; h: number } {
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  return { w: source.width, h: source.height };
}

function drawScaled(source: Source, maxSide: number): HTMLCanvasElement {
  const { w, h } = sizeOf(source);
  if (!w || !h) throw new Error('invalid_image');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('invalid_image');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeUnder(canvas: HTMLCanvasElement, qualities: number[], maxBytes: number): Promise<Blob> {
  for (const q of qualities) {
    let blob = await toBlob(canvas, 'image/webp', q);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', q);
    if (blob && blob.size <= maxBytes) return blob;
  }
  throw new Error('photo_too_big');
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
