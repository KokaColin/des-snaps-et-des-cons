import { drawPhotos } from '../photos';
import { pickMany } from '../rng';
import type { GameState, PlayerId } from '../types';
import type { Gadget, GadgetResult } from './gadget';

/**
 * Gadget Fauto : imposer une photo de la bibliothèque Fauto au prochain meme d'un adversaire.
 *
 * - À la fin de la manche 1, un tiers des joueurs (arrondi à l'inférieur) reçoit une Fauto.
 * - Utilisable une fois par partie, pendant les résultats de la manche 1 ou de la manche 2.
 * - Déroulement : activer → roulette (3 photos proposées) → choisir photo et cible → envoyer.
 * - Annuler avant la roulette : sans conséquence. Après la roulette : inutilisable pendant cette
 *   fenêtre, réutilisable à la suivante s'il en reste une, sinon perdue.
 */
export type HolderStatus = 'ready' | 'activated' | 'spun' | 'used' | 'lost';

export interface FautoHolder {
  status: HolderStatus;
  /** Manche (fenêtre de résultats) à partir de laquelle la Fauto redevient utilisable. */
  lockedUntilRound: number | null;
  /** Photos proposées par la roulette. */
  offer: string[];
}

export interface FautoSend {
  /** Manche pendant les résultats de laquelle la Fauto a été envoyée. */
  round: number;
  from: PlayerId;
  to: PlayerId;
  photoId: string;
}

export interface FautoState {
  holders: Record<PlayerId, FautoHolder>;
  drawn: boolean;
  sent: FautoSend[];
}

export type FautoOp =
  | { op: 'activate' }
  | { op: 'cancel' }
  | { op: 'spin' }
  | { op: 'send'; photoId: string; targetId: PlayerId };

export function initialFautoState(): FautoState {
  return { holders: {}, drawn: false, sent: [] };
}

/** Fenêtre ouverte : résultats d'une manche qui n'est pas la dernière. */
export function isWindowOpen(state: GameState): boolean {
  return state.phase === 'results' && state.round < state.config.rounds;
}

function isUsableNow(state: GameState, holder: FautoHolder): boolean {
  if (holder.status === 'used' || holder.status === 'lost') return false;
  return holder.lockedUntilRound === null || holder.lockedUntilRound <= state.round;
}

/** Cibles encore libres pour la fenêtre en cours, du point de vue de `from`. */
export function availableTargets(state: GameState, from: PlayerId): PlayerId[] {
  const taken = new Set(state.gadgets.fauto.sent.filter((s) => s.round === state.round).map((s) => s.to));
  return state.players.map((p) => p.id).filter((id) => id !== from && !taken.has(id));
}

/** Nombre de Fauto pas encore jouées ni perdues (affiché à tous). */
export function fautoInCirculation(state: GameState): number {
  return Object.values(state.gadgets.fauto.holders).filter(
    (h) => h.status !== 'used' && h.status !== 'lost',
  ).length;
}

function closeAfterSpin(state: GameState, holder: FautoHolder): void {
  holder.offer = [];
  if (state.round + 1 < state.config.rounds) {
    holder.status = 'ready';
    holder.lockedUntilRound = state.round + 1;
  } else {
    holder.status = 'lost';
  }
}

export const fauto: Gadget<FautoOp> = {
  id: 'fauto',

  onResultsStart(state) {
    const f = state.gadgets.fauto;
    if (f.drawn || state.round !== 1) return;
    f.drawn = true;
    const count = Math.floor(state.players.length / 3);
    for (const id of pickMany(state.rng, state.players.map((p) => p.id), count)) {
      f.holders[id] = { status: 'ready', lockedUntilRound: null, offer: [] };
    }
  },

  wantsLongerResults(state) {
    if (!isWindowOpen(state) || state.library.fauto.length === 0) return false;
    return Object.values(state.gadgets.fauto.holders).some((h) => isUsableNow(state, h));
  },

  onResultsEnd(state) {
    for (const holder of Object.values(state.gadgets.fauto.holders)) {
      if (holder.status === 'activated') holder.status = 'ready';
      else if (holder.status === 'spun') closeAfterSpin(state, holder);
    }
  },

  handle(state, playerId, action): GadgetResult {
    const holder = state.gadgets.fauto.holders[playerId];
    if (!holder) return { ok: false, error: 'fauto_not_holder' };
    if (!isWindowOpen(state)) return { ok: false, error: 'fauto_window_closed' };

    switch (action.op) {
      case 'activate': {
        if (holder.status !== 'ready' || !isUsableNow(state, holder)) {
          return { ok: false, error: 'fauto_unavailable' };
        }
        if (state.library.fauto.length === 0) return { ok: false, error: 'fauto_library_empty' };
        holder.status = 'activated';
        return { ok: true };
      }
      case 'cancel': {
        if (holder.status === 'activated') {
          holder.status = 'ready';
          return { ok: true };
        }
        if (holder.status === 'spun') {
          closeAfterSpin(state, holder);
          return { ok: true };
        }
        return { ok: false, error: 'fauto_nothing_to_cancel' };
      }
      case 'spin': {
        if (holder.status !== 'activated') return { ok: false, error: 'fauto_not_activated' };
        const offer = drawPhotos(
          state.rng,
          state.library.fauto,
          state.config.fautoOfferSize,
          new Set([...state.usedPhotoIds, ...state.gadgets.fauto.sent.map((s) => s.photoId)]),
        );
        if (offer.length === 0) return { ok: false, error: 'fauto_library_empty' };
        holder.status = 'spun';
        holder.offer = offer;
        return { ok: true };
      }
      case 'send': {
        if (holder.status !== 'spun') return { ok: false, error: 'fauto_not_spun' };
        if (!holder.offer.includes(action.photoId)) return { ok: false, error: 'fauto_bad_photo' };
        if (action.targetId === playerId) return { ok: false, error: 'fauto_self_target' };
        if (!state.players.some((p) => p.id === action.targetId)) {
          return { ok: false, error: 'fauto_unknown_target' };
        }
        if (!availableTargets(state, playerId).includes(action.targetId)) {
          return { ok: false, error: 'fauto_target_taken' };
        }
        state.gadgets.fauto.sent.push({
          round: state.round,
          from: playerId,
          to: action.targetId,
          photoId: action.photoId,
        });
        holder.status = 'used';
        holder.offer = [];
        return { ok: true };
      }
    }
  },

  imposedPhotos(state, roundIndex) {
    const imposed: Record<PlayerId, { photoId: string; by: PlayerId }> = {};
    for (const s of state.gadgets.fauto.sent) {
      if (s.round + 1 === roundIndex) imposed[s.to] = { photoId: s.photoId, by: s.from };
    }
    return imposed;
  },
};
