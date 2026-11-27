import { describe, expect, it } from 'vitest';
import { currentRound, setLibrary, tick } from '../src/shared/engine';
import { availableTargets, fautoInCirculation } from '../src/shared/gadgets/fauto';
import type { GameState } from '../src/shared/types';
import { act, expectOk, library, nextRound, playRound, started } from './helpers';

/** Partie jouée jusqu'aux résultats de la manche 1. */
function atRound1Results(players: number, opts: { fauto?: number; seed?: number } = {}) {
  const s = started(players, 0, opts);
  playRound(s, () => 10);
  expect(s.phase).toBe('results');
  return s;
}

const holders = (s: GameState) => Object.keys(s.gadgets.fauto.holders);
const fauto = (s: GameState, id: string, op: object) => act(s, id, { type: 'gadget', gadget: 'fauto', ...op } as never);

describe('Fauto : attribution', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 2],
    [7, 2],
  ])('%i joueurs → %i Fauto', (players, expected) => {
    expect(holders(atRound1Results(players))).toHaveLength(expected);
  });

  it('aucune Fauto pendant la manche 1', () => {
    const s = started(6);
    expect(holders(s)).toHaveLength(0);
    expect(fauto(s, 'm0', { op: 'activate' })).toEqual({ ok: false, error: 'fauto_not_holder' });
  });

  it('les résultats durent 40 s quand une Fauto est jouable, 30 s sinon', () => {
    const s = atRound1Results(3);
    expect(s.deadline! - s.phaseStartedAt).toBe(40_000);
    const empty = atRound1Results(3, { fauto: 0 });
    expect(empty.deadline! - empty.phaseStartedAt).toBe(30_000);
  });

  it('un non-détenteur ne peut rien faire', () => {
    const s = atRound1Results(3);
    const other = s.players.find((p) => !holders(s).includes(p.id))!.id;
    expect(fauto(s, other, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_not_holder' });
  });
});

describe('Fauto : déroulement', () => {
  it('activer → roulette → envoyer : photo imposée à la manche suivante', () => {
    const s = atRound1Results(3);
    const from = holders(s)[0]!;
    const target = s.players.find((p) => p.id !== from)!.id;
    expectOk(fauto(s, from, { op: 'activate' }));
    expectOk(fauto(s, from, { op: 'spin' }));
    const offer = s.gadgets.fauto.holders[from]!.offer;
    expect(offer).toHaveLength(3);
    expect(new Set(offer).size).toBe(3);
    expectOk(fauto(s, from, { op: 'send', photoId: offer[1], targetId: target }));
    expect(fautoInCirculation(s)).toBe(0);

    nextRound(s);
    const assignment = currentRound(s).assignments[target]!;
    expect(assignment).toMatchObject({ photoId: offer[1], category: 'fauto', imposedBy: from });
    expect(act(s, target, { type: 'reroll' })).toEqual({ ok: false, error: 'reroll_imposed' });

    playRound(s, () => 10);
    const meme = currentRound(s).results!.memes.find((m) => m.authorId === target)!;
    expect(meme.imposedBy).toBe(from); // révélé dans les résultats
  });

  it('on ne peut pas se cibler soi-même ni envoyer une photo hors roulette', () => {
    const s = atRound1Results(3);
    const from = holders(s)[0]!;
    fauto(s, from, { op: 'activate' });
    fauto(s, from, { op: 'spin' });
    const offer = s.gadgets.fauto.holders[from]!.offer;
    expect(fauto(s, from, { op: 'send', photoId: offer[0], targetId: from })).toEqual({ ok: false, error: 'fauto_self_target' });
    expect(fauto(s, from, { op: 'send', photoId: 'f-bidon', targetId: 'm1' })).toEqual({ ok: false, error: 'fauto_bad_photo' });
  });

  it('deux Fauto dans la même fenêtre : jamais sur la même cible (premier arrivé)', () => {
    const s = atRound1Results(7);
    const [a, b] = holders(s) as [string, string];
    const target = s.players.find((p) => p.id !== a && p.id !== b)!.id;
    for (const h of [a, b]) {
      fauto(s, h, { op: 'activate' });
      fauto(s, h, { op: 'spin' });
    }
    expectOk(fauto(s, a, { op: 'send', photoId: s.gadgets.fauto.holders[a]!.offer[0], targetId: target }));
    expect(availableTargets(s, b)).not.toContain(target);
    expect(fauto(s, b, { op: 'send', photoId: s.gadgets.fauto.holders[b]!.offer[0], targetId: target })).toEqual({
      ok: false,
      error: 'fauto_target_taken',
    });
    // b choisit une autre cible
    const other = availableTargets(s, b)[0]!;
    expectOk(fauto(s, b, { op: 'send', photoId: s.gadgets.fauto.holders[b]!.offer[0], targetId: other }));
  });

  it('annuler avant la roulette : on peut réactiver', () => {
    const s = atRound1Results(3);
    const h = holders(s)[0]!;
    expectOk(fauto(s, h, { op: 'activate' }));
    expectOk(fauto(s, h, { op: 'cancel' }));
    expectOk(fauto(s, h, { op: 'activate' }));
  });

  it('annuler après la roulette en manche 1 : bloquée pour cette fenêtre, utilisable en manche 2', () => {
    const s = atRound1Results(3);
    const h = holders(s)[0]!;
    fauto(s, h, { op: 'activate' });
    fauto(s, h, { op: 'spin' });
    expectOk(fauto(s, h, { op: 'cancel' }));
    expect(fauto(s, h, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_unavailable' });
    nextRound(s);
    playRound(s, () => 10);
    expect(s.round).toBe(2);
    expectOk(fauto(s, h, { op: 'activate' }));
  });

  it('annuler après la roulette en manche 2 : Fauto perdue', () => {
    const s = atRound1Results(3);
    const h = holders(s)[0]!;
    nextRound(s);
    playRound(s, () => 10);
    fauto(s, h, { op: 'activate' });
    fauto(s, h, { op: 'spin' });
    fauto(s, h, { op: 'cancel' });
    expect(s.gadgets.fauto.holders[h]!.status).toBe('lost');
  });

  it('chrono écoulé : avant la roulette la Fauto est gardée, après elle compte comme annulée', () => {
    const s = atRound1Results(6);
    const [kept, spun] = holders(s) as [string, string];
    fauto(s, kept, { op: 'activate' });
    fauto(s, spun, { op: 'activate' });
    fauto(s, spun, { op: 'spin' });
    tick(s, s.deadline!);
    expect(s.gadgets.fauto.holders[kept]).toMatchObject({ status: 'ready', lockedUntilRound: null });
    expect(s.gadgets.fauto.holders[spun]).toMatchObject({ status: 'ready', lockedUntilRound: 2 });
  });

  it('pas de Fauto pendant la création ni après la manche 3', () => {
    const s = atRound1Results(3);
    const h = holders(s)[0]!;
    nextRound(s);
    expect(fauto(s, h, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_window_closed' });
    playRound(s, () => 10);
    nextRound(s);
    playRound(s, () => 10);
    expect(s.round).toBe(3);
    expect(s.phase).toBe('results');
    expect(s.deadline! - s.phaseStartedAt).toBe(30_000);
    expect(fauto(s, h, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_window_closed' });
  });

  it('bibliothèque Fauto vide : gadget inutilisable', () => {
    const s = atRound1Results(3, { fauto: 0 });
    const h = holders(s)[0]!;
    expect(fauto(s, h, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_library_empty' });
  });

  it('moins de 3 Fauto en bibliothèque : la roulette propose celles qui existent', () => {
    const s = atRound1Results(3, { fauto: 2 });
    const h = holders(s)[0]!;
    fauto(s, h, { op: 'activate' });
    fauto(s, h, { op: 'spin' });
    expect(s.gadgets.fauto.holders[h]!.offer).toHaveLength(2);
  });

  it('une seule utilisation par partie', () => {
    const s = atRound1Results(3);
    const h = holders(s)[0]!;
    const target = s.players.find((p) => p.id !== h)!.id;
    fauto(s, h, { op: 'activate' });
    fauto(s, h, { op: 'spin' });
    fauto(s, h, { op: 'send', photoId: s.gadgets.fauto.holders[h]!.offer[0], targetId: target });
    nextRound(s);
    playRound(s, () => 10);
    expect(fauto(s, h, { op: 'activate' })).toEqual({ ok: false, error: 'fauto_unavailable' });
  });

  it('une photo Fauto déjà jouée n’est pas reproposée', () => {
    const s = atRound1Results(6);
    setLibrary(s, { ...s.library, fauto: library(0, 4).fauto });
    const [a, b] = holders(s) as [string, string];
    fauto(s, a, { op: 'activate' });
    fauto(s, a, { op: 'spin' });
    const sentPhoto = s.gadgets.fauto.holders[a]!.offer[0]!;
    const target = s.players.find((p) => p.id !== a && p.id !== b)!.id;
    fauto(s, a, { op: 'send', photoId: sentPhoto, targetId: target });
    fauto(s, b, { op: 'activate' });
    fauto(s, b, { op: 'spin' });
    expect(s.gadgets.fauto.holders[b]!.offer).not.toContain(sentPhoto);
  });
});
