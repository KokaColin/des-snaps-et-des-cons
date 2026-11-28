import { describe, expect, it } from 'vitest';
import { addPlayer, createGame, dispatch, setConnection, setLibrary, startBlockers } from '../src/shared/engine';
import { library, lobby, T0 } from './helpers';

const fresh = () => createGame({ code: 'ABCDE', now: T0, seed: 1 });

describe('Salon : arrivée des joueurs', () => {
  it("le premier joueur est l'organisateur et doit être membre", () => {
    const s = fresh();
    expect(addPlayer(s, { id: 'g', kind: 'guest', name: 'Bob' }, T0)).toEqual({ ok: false, error: 'host_must_be_member' });
    expect(addPlayer(s, { id: 'a', kind: 'member', member: 'Maxe' }, T0).ok).toBe(true);
    expect(s.hostId).toBe('a');
  });

  it('un nom de membre ne peut être pris qu’une fois', () => {
    const s = fresh();
    addPlayer(s, { id: 'a', kind: 'member', member: 'Maxe' }, T0);
    expect(addPlayer(s, { id: 'b', kind: 'member', member: 'Maxe' }, T0)).toEqual({ ok: false, error: 'name_taken' });
  });

  it('refuse un nom de membre inconnu', () => {
    const s = fresh();
    expect(addPlayer(s, { id: 'a', kind: 'member', member: 'Bob' as never }, T0).ok).toBe(false);
  });

  it('toujours strictement plus de membres que d’invités à l’entrée', () => {
    const s = fresh();
    addPlayer(s, { id: 'm0', kind: 'member', member: 'Maxe' }, T0);
    // 1 membre + 1 invité : interdit (pas strictement plus de membres).
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: 'Bob' }, T0)).toEqual({ ok: false, error: 'not_enough_members' });
    addPlayer(s, { id: 'm1', kind: 'member', member: 'Caulin' }, T0);
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: 'Bob' }, T0).ok).toBe(true); // 2 + 1
    expect(addPlayer(s, { id: 'g1', kind: 'guest', name: 'Bill' }, T0).ok).toBe(false); // 2 + 2 interdit
  });

  it('3 invités au maximum, 7 joueurs au maximum', () => {
    const s = lobby(4, 3);
    expect(s.players).toHaveLength(7);
    expect(addPlayer(s, { id: 'x', kind: 'member', member: 'Tibaud' }, T0)).toEqual({ ok: false, error: 'room_full' });
    const s2 = lobby(7);
    expect(s2.players).toHaveLength(7);
  });

  it('limite de 3 invités appliquée même si la règle des membres le permettrait', () => {
    const s = createGame({ code: 'ABCDE', now: T0, seed: 1, config: { maxPlayers: 10 } });
    for (const m of ['Maxe', 'Caulin', 'Tibaud', 'Trystan', 'Raffael'] as const) {
      addPlayer(s, { id: m, kind: 'member', member: m }, T0);
    }
    for (const g of ['A', 'B', 'C']) expect(addPlayer(s, { id: g, kind: 'guest', name: g }, T0).ok).toBe(true);
    expect(addPlayer(s, { id: 'D', kind: 'guest', name: 'D' }, T0)).toEqual({ ok: false, error: 'too_many_guests' });
  });

  it('pseudo invité : nettoyé, 12 caractères maximum, pas de doublon ni de nom de membre', () => {
    const s = lobby(3);
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: '   ' }, T0).ok).toBe(false);
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: 'Un pseudo bien trop long' }, T0).ok).toBe(false);
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: 'maxe' }, T0)).toEqual({ ok: false, error: 'name_taken' });
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: 'Gaslard' }, T0)).toEqual({ ok: false, error: 'name_taken' });
    expect(addPlayer(s, { id: 'g0', kind: 'guest', name: '  Jean   Mi ' }, T0).ok).toBe(true);
    expect(s.players.at(-1)?.name).toBe('Jean Mi');
  });

  it('impossible de rejoindre une partie lancée', () => {
    const s = lobby(3);
    dispatch(s, 'm0', { type: 'start' }, T0);
    expect(addPlayer(s, { id: 'x', kind: 'member', member: 'Tibaud' }, T0)).toEqual({ ok: false, error: 'game_started' });
  });
});

describe('Salon : lancement', () => {
  it('impossible à moins de 3 joueurs', () => {
    const s = lobby(2);
    expect(startBlockers(s)).toContain('not_enough_players');
    expect(dispatch(s, 'm0', { type: 'start' }, T0)).toEqual({ ok: false, error: 'not_enough_players' });
  });

  it('seul l’organisateur lance, quand tout le monde est prêt et présent', () => {
    const s = lobby(3);
    expect(dispatch(s, 'm1', { type: 'start' }, T0)).toEqual({ ok: false, error: 'not_host' });
    dispatch(s, 'm2', { type: 'ready', ready: false }, T0);
    expect(startBlockers(s)).toEqual(['players_not_ready']);
    dispatch(s, 'm2', { type: 'ready', ready: true }, T0);
    setConnection(s, 'm2', false, T0);
    expect(startBlockers(s)).toEqual(['players_absent']);
    setConnection(s, 'm2', true, T0);
    expect(dispatch(s, 'm0', { type: 'start' }, T0).ok).toBe(true);
    expect(s.phase).toBe('creation');
    expect(s.round).toBe(1);
  });

  it('l’organisateur est compté prêt d’office', () => {
    const s = lobby(3);
    dispatch(s, 'm0', { type: 'ready', ready: false }, T0);
    expect(startBlockers(s)).toEqual([]);
  });

  it('exige au moins 2 photos iconiques par joueur', () => {
    const s = lobby(4);
    setLibrary(s, library(7));
    expect(startBlockers(s)).toEqual(['not_enough_photos']);
    setLibrary(s, library(8));
    expect(startBlockers(s)).toEqual([]);
  });

  it('l’organisateur peut exclure un joueur du salon', () => {
    const s = lobby(4);
    expect(dispatch(s, 'm1', { type: 'kick', playerId: 'm2' }, T0).ok).toBe(false);
    expect(dispatch(s, 'm0', { type: 'kick', playerId: 'm2' }, T0).ok).toBe(true);
    expect(s.players.map((p) => p.id)).toEqual(['m0', 'm1', 'm3']);
  });

  it('organisateur déconnecté : le rôle passe au plus ancien membre connecté', () => {
    const s = lobby(3, 1);
    setConnection(s, 'm0', false, T0);
    expect(s.hostId).toBe('m1');
    setConnection(s, 'm0', true, T0);
    expect(s.hostId).toBe('m1'); // il ne le récupère pas
  });
});
