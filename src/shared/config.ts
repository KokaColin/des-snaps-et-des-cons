/**
 * Règles chiffrées d'une partie. Tout ce qui est réglable vit ici, pour que de futures
 * variantes de règles n'aient qu'à fournir une autre configuration.
 */
export const MEMBER_NAMES = [
  'Trystan',
  'Raffael',
  'Maxe',
  'Gasdard',
  'Gaslard',
  'Caulin',
  'Tibaud',
] as const;

export type MemberName = (typeof MEMBER_NAMES)[number];

export function isMemberName(value: unknown): value is MemberName {
  return typeof value === 'string' && (MEMBER_NAMES as readonly string[]).includes(value);
}

export interface GameConfig {
  rounds: number;
  minPlayers: number;
  maxPlayers: number;
  maxGuests: number;
  guestNameMaxLength: number;
  creationMs: number;
  votePerMemeMs: number;
  resultsMs: number;
  /** Durée des résultats quand un détenteur peut encore jouer sa Fauto. */
  resultsWithGadgetMs: number;
  loadingMs: number;
  maxNote: number;
  /** Score d'un meme qui n'a reçu aucun vote réel. */
  neutralScore: number;
  /** Nombre minimal de votes réels (tous à 22) pour un meme légendaire. */
  legendaryMinVotes: number;
  /** Photos iconiques exigées par joueur pour lancer (1 photo + 1 changement). */
  minIconicPerPlayer: number;
  maxTextLayers: number;
  maxTextLength: number;
  /** Un joueur sans signe de vie depuis ce délai est « absent ». */
  absentAfterMs: number;
  /** Fin anticipée de la création : les absents depuis ce délai ne sont plus attendus. */
  creationGraceMs: number;
  /** Partie arrêtée si moins de `minConnected` joueurs pendant ce délai. */
  abandonAfterMs: number;
  minConnected: number;
  /** Nombre de photos proposées par la roulette Fauto. */
  fautoOfferSize: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  rounds: 3,
  minPlayers: 3,
  maxPlayers: 7,
  maxGuests: 3,
  guestNameMaxLength: 12,
  creationMs: 90_000,
  votePerMemeMs: 15_000,
  resultsMs: 30_000,
  resultsWithGadgetMs: 40_000,
  loadingMs: 3_000,
  maxNote: 22,
  neutralScore: 11,
  legendaryMinVotes: 2,
  minIconicPerPlayer: 2,
  maxTextLayers: 3,
  maxTextLength: 120,
  absentAfterMs: 5_000,
  creationGraceMs: 15_000,
  abandonAfterMs: 60_000,
  minConnected: 2,
  fautoOfferSize: 3,
};

/** Les 8 couleurs de texte de l'éditeur (identifiants stables, rendu défini côté client). */
export const TEXT_COLORS = [
  'white',
  'black',
  'yellow',
  'red',
  'pink',
  'blue',
  'green',
  'orange',
] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export const TEXT_STYLES = ['classic', 'snap'] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];
