import { describe, expect, it } from 'vitest';
import { setConnection, tick } from '../src/shared/engine';
import { buildGameRecord } from '../src/shared/record';
import { nextRound, playRound, started } from './helpers';

function playFullGame(note: (voter: string, author: string) => number | null) {
  const s = started(3, 1);
  for (let r = 0; r < 3; r++) {
    playRound(s, note);
    nextRound(s);
  }
  return s;
}

describe('Enregistrement d’une partie terminée', () => {
  it('rien n’est enregistré tant que la partie n’est pas finie', () => {
    const s = started(3);
    expect(buildGameRecord(s, 0, 1)).toBeNull();
  });

  it('une partie arrêtée n’est pas enregistrée', () => {
    const s = started(3);
    for (const id of ['m1', 'm2']) setConnection(s, id, false, s.phaseStartedAt);
    tick(s, s.phaseStartedAt + s.config.abandonAfterMs + 1);
    expect(s.phase).toBe('aborted');
    expect(buildGameRecord(s, 0, 1)).toBeNull();
  });

  it('garde les joueurs (membres et invités), leur classement, leurs badges et les 3 × N memes', () => {
    const s = playFullGame((_v, author) => (author === 'm0' ? 22 : 10));
    expect(s.phase).toBe('final');
    const rec = buildGameRecord(s, 100, 200)!;
    expect(rec).toMatchObject({ code: 'ABCDE', startedAt: 100, endedAt: 200 });
    expect(rec.players).toHaveLength(4);
    expect(rec.players.find((p) => p.id === 'g0')).toMatchObject({ kind: 'guest', member: null });
    const winner = rec.players.find((p) => p.id === 'm0')!;
    expect(winner).toMatchObject({ rank: 1, member: 'Trystan', roundsWon: 3 });
    expect(winner.badges).toContain('goofy');
    expect(rec.memes).toHaveLength(12);
    expect(new Set(rec.memes.map((m) => m.round))).toEqual(new Set([1, 2, 3]));
  });

  it('les memes légendaires sont marqués (toutes les notes à 22, au moins 2)', () => {
    const s = playFullGame((_v, author) => (author === 'm0' ? 22 : 10));
    const rec = buildGameRecord(s, 0, 1)!;
    const legendary = rec.memes.filter((m) => m.legendary);
    expect(legendary).toHaveLength(3);
    expect(legendary.every((m) => m.authorId === 'm0' && Object.values(m.votes).every((n) => n === 22))).toBe(true);
  });
});
