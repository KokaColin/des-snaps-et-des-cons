import { pickMany, shuffle, type RngState } from './rng';
import type { PhotoRef } from './types';

/**
 * Tire `count` photos distinctes.
 *
 * - Jamais une photo de `excluded` (déjà distribuée dans la manche).
 * - De préférence une photo pas encore jouée dans la partie (`usedInGame`).
 * - Parmi celles-ci, priorité aux photos jouées le moins récemment : on tire au hasard
 *   dans le « paquet » des plus anciennes, pour garder de la surprise.
 */
export function drawPhotos(
  rng: RngState,
  pool: readonly PhotoRef[],
  count: number,
  usedInGame: ReadonlySet<string>,
  excluded: ReadonlySet<string> = new Set(),
): string[] {
  const available = pool.filter((p) => !excluded.has(p.id));
  const fresh = available.filter((p) => !usedInGame.has(p.id));
  const picked = pickOldest(rng, fresh, count);
  if (picked.length < count) {
    // Photothèque trop petite : on ressert des photos déjà jouées dans la partie.
    const taken = new Set(picked);
    const reused = available.filter((p) => usedInGame.has(p.id) && !taken.has(p.id));
    picked.push(...pickOldest(rng, reused, count - picked.length));
  }
  return picked;
}

function pickOldest(rng: RngState, photos: readonly PhotoRef[], count: number): string[] {
  if (count <= 0 || photos.length === 0) return [];
  // Mélange d'abord, pour que les ex æquo (ex. jamais jouées) soient départagés au hasard.
  const sorted = shuffle(rng, photos).sort((a, b) => {
    if (a.lastPlayedAt === b.lastPlayedAt) return 0;
    if (a.lastPlayedAt === null) return -1; // jamais jouée = prioritaire
    if (b.lastPlayedAt === null) return 1;
    return a.lastPlayedAt - b.lastPlayedAt;
  });
  const bucket = sorted.slice(0, Math.max(count * 3, 12));
  return pickMany(rng, bucket, count).map((p) => p.id);
}
