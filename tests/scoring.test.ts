import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/shared/config';
import { currentRound } from '../src/shared/engine';
import { format, frac, toNumber } from '../src/shared/fraction';
import { computeRoundResults } from '../src/shared/scoring';
import type { RoundState } from '../src/shared/types';
import { nextRound, playRound, started } from './helpers';

function round(votes: Record<string, Record<string, number>>, authors = Object.keys(votes)): RoundState {
  return {
    index: 1,
    assignments: {},
    drafts: {},
    submitted: {},
    memes: Object.fromEntries(authors.map((a) => [a, { photoId: `p-${a}`, layers: [] }])),
    voteOrder: authors,
    voteCursor: authors.length,
    votes,
    results: null,
  };
}

describe('Score d’un meme', () => {
  it('moyenne exacte des notes réelles', () => {
    const r = computeRoundResults(round({ a: { b: 22, c: 21 }, b: { a: 7, c: 8 }, c: { a: 0, b: 1 } }), DEFAULT_CONFIG);
    const score = (id: string) => r.memes.find((m) => m.authorId === id)!.score;
    expect(score('a')).toEqual(frac(43, 2));
    expect(format(score('a'))).toBe('21,5');
    expect(score('c')).toEqual(frac(1, 2));
  });

  it('un vote manquant ne change pas le score (remplacé par la moyenne des autres)', () => {
    const complete = computeRoundResults(round({ a: { b: 10, c: 16, d: 13 } }), DEFAULT_CONFIG);
    const missing = computeRoundResults(round({ a: { b: 10, c: 16 } }), DEFAULT_CONFIG);
    expect(missing.memes[0]!.score).toEqual(frac(13));
    expect(complete.memes[0]!.score).toEqual(frac(13));
  });

  it('meme sans aucun vote réel : 11/22', () => {
    const r = computeRoundResults(round({}, ['a']), DEFAULT_CONFIG);
    expect(r.memes[0]!.score).toEqual(frac(11));
    expect(r.memes[0]!.legendary).toBe(false);
  });

  it('légendaire : toutes les notes réelles à 22, au moins 2 notes', () => {
    const r = computeRoundResults(
      round({ a: { b: 22, c: 22 }, b: { a: 22 }, c: { a: 22, b: 21 } }),
      DEFAULT_CONFIG,
    );
    const legendary = (id: string) => r.memes.find((m) => m.authorId === id)!.legendary;
    expect(legendary('a')).toBe(true);
    expect(legendary('b')).toBe(false); // une seule note réelle
    expect(legendary('c')).toBe(false);
  });

  it('classement de la manche et co-vainqueurs en cas d’égalité', () => {
    const r = computeRoundResults(round({ a: { b: 12, c: 14 }, b: { a: 13, c: 13 }, c: { a: 2, b: 3 } }), DEFAULT_CONFIG);
    expect(r.memes.map((m) => m.authorId)).toEqual(['a', 'b', 'c']);
    expect(r.winners).toEqual(['a', 'b']);
  });

  it('pas d’erreur d’arrondi : 3 tiers font bien 1', () => {
    const r = computeRoundResults(round({ a: { b: 1, c: 0, d: 0 } }), DEFAULT_CONFIG);
    expect(r.memes[0]!.score).toEqual(frac(1, 3));
  });
});

describe('Classement final', () => {
  /** Joue 3 manches où `scoreOf(round, author)` est la note donnée par tous au meme de `author`. */
  function game(players: number, scoreOf: (round: number, author: string) => number) {
    const s = started(players);
    for (let r = 1; r <= 3; r++) {
      playRound(s, (_voter, author) => scoreOf(r, author));
      nextRound(s);
    }
    expect(s.phase).toBe('final');
    return s.final!;
  }

  it('total = somme des 3 manches, et rangs dans l’ordre', () => {
    const final = game(3, (r, a) => ({ m0: 19, m1: 10, m2: 5 })[a]! + r);
    expect(final.standings.map((s) => [s.playerId, s.rank, toNumber(s.total)])).toEqual([
      ['m0', 1, 63],
      ['m1', 2, 36],
      ['m2', 3, 21],
    ]);
  });

  it('égalité au total : départage au nombre de manches gagnées', () => {
    // m0 : 22 + 0 + 0 = 22 (1 manche gagnée) ; m1 : 10 + 11 + 1 = 22 mais 2 manches gagnées.
    const table: Record<number, Record<string, number>> = {
      1: { m0: 22, m1: 10, m2: 0 },
      2: { m0: 0, m1: 11, m2: 0 },
      3: { m0: 0, m1: 1, m2: 0 },
    };
    const final = game(3, (r, a) => table[r]![a]!);
    expect(final.standings.map((s) => s.playerId)).toEqual(['m1', 'm0', 'm2']);
    expect(final.standings.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it('égalité au total et aux manches : départage au meilleur meme', () => {
    const table: Record<number, Record<string, number>> = {
      1: { m0: 20, m1: 15, m2: 0 },
      2: { m0: 0, m1: 5, m2: 1 },
      3: { m0: 0, m1: 0, m2: 2 },
    };
    // m0 = 20 (1 manche, meilleur 20) ; m1 = 20 (1 manche, meilleur 15)
    const final = game(3, (r, a) => table[r]![a]!);
    expect(final.standings.map((s) => s.playerId).slice(0, 2)).toEqual(['m0', 'm1']);
    expect(final.standings[1]!.rank).toBe(2);
  });

  it('égalité parfaite : place partagée (1, 1, 3)', () => {
    const final = game(3, (_r, a) => (a === 'm2' ? 3 : 15));
    expect(final.standings.map((s) => s.rank)).toEqual([1, 1, 3]);
    expect(final.badges.goofy.sort()).toEqual(['m0', 'm1']);
    expect(final.badges.broke).toEqual(['m2']);
  });

  it('shame ass gwero : la plus petite moyenne de notes données', () => {
    const s = started(3);
    for (let r = 1; r <= 3; r++) {
      playRound(s, (voter) => (voter === 'm1' ? 2 : 18));
      nextRound(s);
    }
    expect(s.final!.badges.shame).toEqual(['m1']);
    const m1 = s.final!.standings.find((x) => x.playerId === 'm1')!;
    expect(m1.averageGiven).toEqual(frac(2));
  });

  it('le score de la manche d’un joueur est celui de son meme', () => {
    const s = started(4);
    playRound(s, (_v, a) => (a === 'm2' ? 21 : 3));
    const results = currentRound(s).results!;
    expect(results.winners).toEqual(['m2']);
    expect(results.memes[0]!.authorId).toBe('m2');
  });
});
