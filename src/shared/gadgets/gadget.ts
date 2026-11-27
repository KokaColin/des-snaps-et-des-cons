import type { GameState, PlayerId } from '../types';

export type GadgetResult = { ok: true } | { ok: false; error: string };

/**
 * Contrat commun à tous les gadgets. Le moteur appelle ces points d'accroche aux moments clés ;
 * ajouter un gadget = écrire un nouveau module qui respecte ce contrat et l'enregistrer
 * dans `gadgets/index.ts`, sans toucher au déroulement d'une manche.
 */
export interface Gadget<Action> {
  id: string;
  /** Au début de l'écran de résultats d'une manche. */
  onResultsStart(state: GameState): void;
  /** Le gadget a-t-il besoin de résultats plus longs (quelqu'un peut encore le jouer) ? */
  wantsLongerResults(state: GameState): boolean;
  /** À la fin de l'écran de résultats, avant la manche suivante. */
  onResultsEnd(state: GameState): void;
  /** Action d'un joueur sur ce gadget. */
  handle(state: GameState, playerId: PlayerId, action: Action): GadgetResult;
  /** Photos imposées pour une manche donnée : joueur ciblé → photo et auteur. */
  imposedPhotos(state: GameState, roundIndex: number): Record<PlayerId, { photoId: string; by: PlayerId }>;
}
