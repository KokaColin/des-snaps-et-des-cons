import { TEXT_COLORS, TEXT_STYLES, type GameConfig, type TextColor, type TextStyle } from './config';

/**
 * Un meme est stocké comme une « recette » (photo + zones de texte), jamais comme une image :
 * le stockage reste minuscule et l'image est recomposée à l'affichage ou au téléchargement.
 */
export interface TextLayer {
  text: string;
  /** Position du centre de la zone, en fraction de la largeur/hauteur de l'image (0 à 1). */
  x: number;
  y: number;
  /** Taille du texte en fraction de la largeur de l'image (0,03 à 0,25). */
  size: number;
  style: TextStyle;
  color: TextColor;
}

export interface MemeRecipe {
  photoId: string;
  layers: TextLayer[];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Nettoie des zones de texte envoyées par un client. Renvoie null si le format est invalide.
 * Les valeurs hors bornes sont ramenées dans les bornes plutôt que refusées.
 */
export function sanitizeLayers(input: unknown, config: GameConfig): TextLayer[] | null {
  if (!Array.isArray(input) || input.length > config.maxTextLayers) return null;
  const layers: TextLayer[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null;
    const l = raw as Record<string, unknown>;
    if (typeof l.text !== 'string') return null;
    if (typeof l.x !== 'number' || typeof l.y !== 'number' || typeof l.size !== 'number') return null;
    if (![l.x, l.y, l.size].every(Number.isFinite)) return null;
    if (!(TEXT_STYLES as readonly unknown[]).includes(l.style)) return null;
    if (!(TEXT_COLORS as readonly unknown[]).includes(l.color)) return null;
    layers.push({
      text: l.text.slice(0, config.maxTextLength),
      x: clamp(l.x, 0, 1),
      y: clamp(l.y, 0, 1),
      size: clamp(l.size, 0.03, 0.25),
      style: l.style as TextStyle,
      color: l.color as TextColor,
    });
  }
  return layers;
}

/** Modèle proposé d'office : une zone en haut, une en bas, style meme classique. */
export function defaultLayers(): TextLayer[] {
  return [
    { text: '', x: 0.5, y: 0.1, size: 0.09, style: 'classic', color: 'white' },
    { text: '', x: 0.5, y: 0.9, size: 0.09, style: 'classic', color: 'white' },
  ];
}
