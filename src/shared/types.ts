import type { GameConfig, MemberName } from './config';
import type { Fraction } from './fraction';
import type { MemeRecipe, TextLayer } from './meme';
import type { RngState } from './rng';
import type { FautoState } from './gadgets/fauto';

export type PlayerId = string;

export type Phase = 'lobby' | 'creation' | 'vote' | 'results' | 'loading' | 'final' | 'aborted';

export type PlayerKind = 'member' | 'guest';

export interface Player {
  id: PlayerId;
  /** Nom de membre ou pseudo d'invité. */
  name: string;
  kind: PlayerKind;
  member: MemberName | null;
  joinedAt: number;
  connected: boolean;
  /** Dernier signe de vie reçu. */
  lastSeenAt: number;
  /** Instant de la déconnexion en cours, null si connecté. */
  disconnectedAt: number | null;
  ready: boolean;
}

export type PhotoCategory = 'iconic' | 'fauto';

/** Photo telle que la voit le moteur : un identifiant et sa dernière utilisation en partie. */
export interface PhotoRef {
  id: string;
  lastPlayedAt: number | null;
}

/** Copie de la photothèque prise au lancement de la partie. */
export interface LibrarySnapshot {
  iconic: PhotoRef[];
  fauto: PhotoRef[];
}

export interface Assignment {
  photoId: string;
  category: PhotoCategory;
  /** Joueur qui a imposé cette photo via une Fauto, sinon null. */
  imposedBy: PlayerId | null;
  rerolled: boolean;
}

export interface MemeResult {
  authorId: PlayerId;
  recipe: MemeRecipe;
  imposedBy: PlayerId | null;
  /** Notes réellement données, par votant. */
  votes: Record<PlayerId, number>;
  score: Fraction;
  legendary: boolean;
}

export interface RoundResults {
  /** Memes triés par score décroissant (ordre stable en cas d'égalité). */
  memes: MemeResult[];
  /** Vainqueurs de la manche (plusieurs en cas d'égalité). */
  winners: PlayerId[];
}

export interface RoundState {
  index: number;
  assignments: Record<PlayerId, Assignment>;
  drafts: Record<PlayerId, TextLayer[]>;
  submitted: Record<PlayerId, boolean>;
  /** Memes définitifs, figés à la fin de la création. */
  memes: Record<PlayerId, MemeRecipe>;
  /** Ordre de passage des memes au vote (auteurs mélangés). */
  voteOrder: PlayerId[];
  voteCursor: number;
  /** votes[auteur][votant] = note */
  votes: Record<PlayerId, Record<PlayerId, number>>;
  results: RoundResults | null;
}

export interface Standing {
  playerId: PlayerId;
  /** Rang avec places partagées : 1, 1, 3… */
  rank: number;
  total: Fraction;
  perRound: Fraction[];
  roundsWon: number;
  bestMeme: Fraction;
  /** Moyenne des notes données, null si le joueur n'a jamais voté. */
  averageGiven: Fraction | null;
}

export interface FinalResults {
  standings: Standing[];
  badges: {
    /** goofy ass gwero : le plus de points. */
    goofy: PlayerId[];
    /** broke ass gwero : le moins de points. */
    broke: PlayerId[];
    /** shame ass gwero : la plus petite moyenne de notes données. */
    shame: PlayerId[];
  };
}

export interface GameState {
  version: 1;
  code: string;
  config: GameConfig;
  rng: RngState;
  phase: Phase;
  phaseStartedAt: number;
  /** Fin de la phase en cours (chrono), null si la phase n'a pas de limite. */
  deadline: number | null;
  players: Player[];
  hostId: PlayerId | null;
  /** Numéro de la manche en cours (0 au salon). */
  round: number;
  rounds: RoundState[];
  library: LibrarySnapshot;
  /** Photos déjà utilisées dans la partie (les deux catégories). */
  usedPhotoIds: string[];
  gadgets: { fauto: FautoState };
  /** Début de la période où trop peu de joueurs sont connectés. */
  lowConnectivitySince: number | null;
  final: FinalResults | null;
  abortReason: string | null;
}
