/**
 * Générateur pseudo-aléatoire déterministe (mulberry32). Son état est un simple entier
 * stocké dans l'état de la partie : une partie rechargée depuis le stockage continue
 * exactement là où elle en était, et les tests sont reproductibles.
 */
export interface RngState {
  seed: number;
}

export function nextFloat(rng: RngState): number {
  rng.seed = (rng.seed + 0x6d2b79f5) | 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: RngState, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function pickMany<T>(rng: RngState, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, Math.max(0, count));
}
