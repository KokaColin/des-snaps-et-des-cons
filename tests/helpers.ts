import { MEMBER_NAMES } from '../src/shared/config';
import { addPlayer, createGame, currentRound, dispatch, setLibrary, tick, type Action } from '../src/shared/engine';
import type { GameState, PhotoRef } from '../src/shared/types';

export const T0 = 1_000_000;

export function library(iconic: number, fauto = 0, lastPlayed: (i: number) => number | null = () => null) {
  const make = (prefix: string, n: number): PhotoRef[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, lastPlayedAt: lastPlayed(i) }));
  return { iconic: make('i', iconic), fauto: make('f', fauto) };
}

/** Salon prêt à lancer : `members` membres (dont l'organisateur m0) et `guests` invités. */
export function lobby(members: number, guests = 0, opts: { iconic?: number; fauto?: number; seed?: number } = {}) {
  const state = createGame({ code: 'ABCDE', now: T0, seed: opts.seed ?? 42 });
  for (let i = 0; i < members; i++) {
    expectOk(addPlayer(state, { id: `m${i}`, kind: 'member', member: MEMBER_NAMES[i]! }, T0));
  }
  for (let i = 0; i < guests; i++) {
    expectOk(addPlayer(state, { id: `g${i}`, kind: 'guest', name: `Invité ${i}` }, T0));
  }
  setLibrary(state, library(opts.iconic ?? 200, opts.fauto ?? 20));
  for (const p of state.players) expectOk(dispatch(state, p.id, { type: 'ready', ready: true }, T0));
  return state;
}

export function started(members: number, guests = 0, opts: Parameters<typeof lobby>[2] = {}) {
  const state = lobby(members, guests, opts);
  expectOk(dispatch(state, 'm0', { type: 'start' }, T0));
  return state;
}

export function expectOk(result: { ok: boolean; error?: string }) {
  if (!result.ok) throw new Error(`Action refusée : ${result.error}`);
}

export const ids = (state: GameState) => state.players.map((p) => p.id);

export function act(state: GameState, playerId: string, action: Action, now = state.phaseStartedAt) {
  return dispatch(state, playerId, action, now);
}

export const layer = (text: string) => ({ text, x: 0.5, y: 0.1, size: 0.09, style: 'classic', color: 'white' });

/** Tout le monde valide un meme portant son identifiant. */
export function submitAll(state: GameState) {
  for (const id of ids(state)) expectOk(act(state, id, { type: 'submit', layers: [layer(`meme de ${id}`)] }));
}

/**
 * Fait voter tout le monde sur tous les memes de la manche.
 * `noteFor(voter, author)` renvoie la note, ou null pour ne pas voter.
 */
export function voteAll(state: GameState, noteFor: (voter: string, author: string) => number | null) {
  const round = currentRound(state);
  while (state.phase === 'vote') {
    const author = round.voteOrder[round.voteCursor]!;
    const cursor = round.voteCursor;
    for (const voter of ids(state)) {
      if (voter === author) continue;
      const note = noteFor(voter, author);
      if (note !== null) expectOk(act(state, voter, { type: 'vote', index: cursor, note }));
    }
    if (state.phase === 'vote' && round.voteCursor === cursor) tick(state, state.deadline!);
  }
}

/** Fin des résultats puis du chargement : début de la manche suivante (ou fin de partie). */
export function nextRound(state: GameState) {
  if (state.phase === 'results') tick(state, state.deadline!);
  if (state.phase === 'loading') tick(state, state.deadline!);
}

export function playRound(state: GameState, noteFor: (voter: string, author: string) => number | null) {
  submitAll(state);
  voteAll(state, noteFor);
}
