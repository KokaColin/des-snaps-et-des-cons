/**
 * Messages échangés entre l'application et le serveur (WebSocket du salon, API HTTP).
 * Partagé par les deux côtés pour que les formats ne divergent jamais.
 */
import type { MemberName } from './config';
import type { Action } from './engine';
import type { PhotoCategory } from './types';
import type { GameView } from './view';

// ---------------------------------------------------------------------------------------------
// Temps réel (WebSocket /ws/:code)
// ---------------------------------------------------------------------------------------------

/** Message texte envoyé toutes les quelques secondes ; le serveur répond « pong » sans se réveiller. */
export const PING = 'ping';
export const PONG = 'pong';
export const PING_INTERVAL_MS = 2_000;

export type ClientMessage =
  /**
   * Premier message, obligatoire : jeton de l'appareil s'il en a un, pseudo pour un invité.
   * (Rien de tout ça dans l'adresse de connexion, qui peut finir dans des journaux.)
   */
  | { t: 'hello'; token?: string; name?: string }
  | { t: 'action'; action: Action }
  /** Quitter le salon (avant le lancement uniquement). */
  | { t: 'leave' };

export type ServerMessage =
  /** Envoyé à la connexion. `token` n'est présent que lorsqu'un nouveau jeton est attribué. */
  | { t: 'welcome'; playerId: string; token?: string }
  | { t: 'view'; view: GameView }
  /** Action refusée (le code est traduit côté application). */
  | { t: 'error'; error: string }
  /** Connexion fermée par le serveur ; `reason` explique pourquoi. */
  | { t: 'bye'; reason: ByeReason };

export type ByeReason =
  | 'room_not_found'
  | 'expired'
  | 'kicked'
  | 'left'
  | 'invalid_token'
  | 'need_name'
  | 'waiting_for_host'
  | 'join_refused'
  | 'timeout';

/** Codes de fermeture WebSocket propres à l'application (4000–4999). */
/** Fermeture définitive : l'application ne doit pas se reconnecter. */
export const CLOSE_FINAL = 4000;
/** Connexion muette fermée par le serveur : l'application peut se reconnecter. */
export const CLOSE_SILENT = 4001;

// ---------------------------------------------------------------------------------------------
// API HTTP
// ---------------------------------------------------------------------------------------------

export interface MeResponse {
  member: MemberName | null;
  accounts: { name: MemberName; hasPassword: boolean }[];
}

export interface PhotoInfo {
  id: string;
  category: PhotoCategory;
  author: MemberName;
  createdAt: number;
  width: number;
  height: number;
  size: number;
  uses: number;
  lastPlayedAt: number | null;
  /** Mise à la corbeille, null si la photo est active. */
  deletedAt: number | null;
  deletedBy: MemberName | null;
}

export interface PhotosResponse {
  photos: PhotoInfo[];
  trashDays: number;
}

export interface RoomInfo {
  exists: boolean;
  phase: string | null;
  players: number;
}

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const TRASH_DAYS = 30;
/** Limite d'une valeur SQLite dans un Durable Object (2 Mo), avec une marge. */
export const MAX_PHOTO_BYTES = 1_900_000;
export const MAX_THUMB_BYTES = 300_000;
export const PHOTO_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 400;
