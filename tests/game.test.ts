import { describe, expect, it } from 'vitest';
import { currentRound, setConnection, tick } from '../src/shared/engine';
import { toNumber } from '../src/shared/fraction';
import { nextRound, playRound, started, act, expectOk } from './helpers';
import type { GameState } from '../src/shared/types';

/** Recalcule les totaux « à la main », en flottants, pour vérifier le moteur. */
function naiveTotals(s: GameState): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of s.players) totals[p.id] = 0;
  for (const r of s.rounds) {
    for (const author of r.voteOrder) {
      const notes = Object.values(r.votes[author] ?? {});
      totals[author]! += notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : 11;
    }
  }
  return totals;
}

describe('Parties complètes', () => {
  it.each([3, 7])('partie à %i joueurs, notes aléatoires : scores fiables', (n) => {
    const s = started(n, 0, { seed: n * 101 });
    let x = n;
    const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648), x % 23);
    for (let r = 1; r <= 3; r++) {
      playRound(s, () => rand());
      expect(s.phase).toBe('results');
      nextRound(s);
    }
    expect(s.phase).toBe('final');
    const naive = naiveTotals(s);
    for (const st of s.final!.standings) expect(toNumber(st.total)).toBeCloseTo(naive[st.playerId]!, 9);
    const totals = s.final!.standings.map((st) => toNumber(st.total));
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(s.final!.badges.goofy.length).toBeGreaterThan(0);
  });

  it('partie avec invités (4 membres + 3 invités)', () => {
    const s = started(4, 3);
    for (let r = 1; r <= 3; r++) {
      playRound(s, () => 12);
      nextRound(s);
    }
    expect(s.final!.standings).toHaveLength(7);
  });

  it('deux parties simultanées restent indépendantes', () => {
    const a = started(3, 0, { seed: 1 });
    const b = started(3, 0, { seed: 2 });
    playRound(a, () => 22);
    expect(b.phase).toBe('creation');
    expect(b.rounds[0]!.votes).toEqual({});
  });

  it('revanche : retour au salon avec les mêmes joueurs, scores remis à zéro', () => {
    const s = started(3);
    for (let r = 1; r <= 3; r++) {
      playRound(s, () => 12);
      nextRound(s);
    }
    expect(act(s, 'm1', { type: 'rematch' }).ok).toBe(false);
    expectOk(act(s, 'm0', { type: 'rematch' }));
    expect(s.phase).toBe('lobby');
    expect(s.rounds).toEqual([]);
    expect(s.players.every((p) => !p.ready)).toBe(true);
    expect(Object.keys(s.gadgets.fauto.holders)).toHaveLength(0);
  });
});

describe('Déconnexions', () => {
  it('un joueur qui se déconnecte puis revient retrouve sa partie au même point', () => {
    const s = started(3);
    const t = s.phaseStartedAt;
    expectOk(act(s, 'm2', { type: 'draft', layers: [] }, t));
    setConnection(s, 'm2', false, t + 1000);
    setConnection(s, 'm2', true, t + 4000);
    expect(s.phase).toBe('creation');
    expect(s.players.find((p) => p.id === 'm2')?.connected).toBe(true);
    expect(currentRound(s).assignments.m2).toBeDefined();
  });

  it('moins de 2 joueurs connectés pendant 60 s : partie arrêtée', () => {
    const s = started(3);
    const t = s.phaseStartedAt;
    setConnection(s, 'm1', false, t);
    setConnection(s, 'm2', false, t);
    tick(s, t + 59_999);
    expect(s.phase).not.toBe('aborted');
    tick(s, t + 60_000);
    expect(s.phase).toBe('aborted');
    expect(s.abortReason).toBe('not_enough_connected');
  });

  it('le retour d’un joueur avant 60 s annule l’arrêt', () => {
    const s = started(3);
    const t = s.phaseStartedAt;
    setConnection(s, 'm1', false, t);
    setConnection(s, 'm2', false, t);
    setConnection(s, 'm2', true, t + 30_000);
    tick(s, t + 90_000);
    expect(s.phase).not.toBe('aborted');
  });

  it('serveur endormi longtemps : les échéances en retard sont rattrapées dans l’ordre', () => {
    const s = started(3);
    // Personne ne joue : création (90 s) puis 3 memes au vote (3 × 15 s) → résultats.
    tick(s, s.phaseStartedAt + 90_000 + 45_000);
    expect(s.phase).toBe('results');
    expect(currentRound(s).results!.memes.every((m) => toNumber(m.score) === 11)).toBe(true);
  });

  it('un joueur qui ne termine pas son meme : image sans texte, notée normalement', () => {
    const s = started(3);
    expectOk(act(s, 'm0', { type: 'submit', layers: [] }));
    expectOk(act(s, 'm1', { type: 'submit', layers: [] }));
    tick(s, s.deadline!);
    expect(currentRound(s).memes.m2?.layers).toEqual([]);
    expect(currentRound(s).voteOrder).toContain('m2');
  });
});
