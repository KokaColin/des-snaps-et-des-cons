import type { GameConfig } from './config';
import { add, compare, equals, frac, ZERO, type Fraction } from './fraction';
import type { FinalResults, GameState, MemeResult, PlayerId, RoundResults, RoundState, Standing } from './types';

/**
 * Résultats d'une manche.
 *
 * Score d'un meme = moyenne des notes réellement données. Un vote manquant est remplacé par
 * la moyenne des autres, ce qui revient exactement à l'ignorer. Sans aucun vote réel, le meme
 * reçoit la note neutre. Un meme est légendaire si toutes ses notes réelles valent le maximum,
 * avec au moins `legendaryMinVotes` notes.
 */
export function computeRoundResults(round: RoundState, config: GameConfig): RoundResults {
  const memes: MemeResult[] = round.voteOrder.map((authorId) => {
    const recipe = round.memes[authorId];
    if (!recipe) throw new Error(`Meme manquant pour ${authorId}`);
    const votes = { ...(round.votes[authorId] ?? {}) };
    const notes = Object.values(votes);
    const sum = notes.reduce((a, b) => a + b, 0);
    const score = notes.length > 0 ? frac(sum, notes.length) : frac(config.neutralScore);
    const legendary =
      notes.length >= config.legendaryMinVotes && notes.every((n) => n === config.maxNote);
    return {
      authorId,
      recipe,
      imposedBy: round.assignments[authorId]?.imposedBy ?? null,
      votes,
      score,
      legendary,
    };
  });

  // Tri stable : à score égal, l'ordre de passage au vote est conservé.
  const sorted = memes
    .map((m, i) => ({ m, i }))
    .sort((a, b) => compare(b.m.score, a.m.score) || a.i - b.i)
    .map(({ m }) => m);

  const best = sorted[0]?.score;
  const winners = best ? sorted.filter((m) => equals(m.score, best)).map((m) => m.authorId) : [];
  return { memes: sorted, winners };
}

/** Compare deux joueurs pour le classement final : négatif si `a` est devant `b`. */
function compareStandings(a: Standing, b: Standing): number {
  return (
    compare(b.total, a.total) ||
    b.roundsWon - a.roundsWon ||
    compare(b.bestMeme, a.bestMeme)
  );
}

/**
 * Classement final : total des 3 manches, puis manches gagnées, puis meilleur meme.
 * Si tout est égal, la place est partagée (rangs 1, 1, 3…).
 */
export function computeFinalResults(state: GameState): FinalResults {
  const standings: Standing[] = state.players.map((p) => {
    const perRound: Fraction[] = [];
    let roundsWon = 0;
    let given = 0;
    let givenCount = 0;
    for (const round of state.rounds) {
      const meme = round.results?.memes.find((m) => m.authorId === p.id);
      perRound.push(meme ? meme.score : ZERO);
      if (round.results?.winners.includes(p.id)) roundsWon++;
      for (const byVoter of Object.values(round.votes)) {
        const note = byVoter[p.id];
        if (note !== undefined) {
          given += note;
          givenCount++;
        }
      }
    }
    const total = perRound.reduce(add, ZERO);
    const bestMeme = perRound.reduce((best, s) => (compare(s, best) > 0 ? s : best), ZERO);
    return {
      playerId: p.id,
      rank: 0,
      total,
      perRound,
      roundsWon,
      bestMeme,
      averageGiven: givenCount > 0 ? frac(given, givenCount) : null,
    };
  });

  standings.sort(compareStandings);
  standings.forEach((s, i) => {
    const prev = standings[i - 1];
    s.rank = prev && compareStandings(prev, s) === 0 ? prev.rank : i + 1;
  });

  const lastRank = standings.at(-1)?.rank;
  const voters = standings.filter((s) => s.averageGiven !== null);
  const stingiest = voters.reduce<Fraction | null>(
    (min, s) => (min === null || compare(s.averageGiven as Fraction, min) < 0 ? s.averageGiven : min),
    null,
  );

  return {
    standings,
    badges: {
      goofy: standings.filter((s) => s.rank === 1).map((s) => s.playerId),
      broke: standings.filter((s) => s.rank === lastRank).map((s) => s.playerId),
      shame: stingiest
        ? voters.filter((s) => equals(s.averageGiven as Fraction, stingiest)).map((s) => s.playerId)
        : [],
    },
  };
}

/** Identifiants des joueurs qui peuvent noter un meme : tout le monde sauf son auteur. */
export function eligibleVoters(state: GameState, authorId: PlayerId): PlayerId[] {
  return state.players.filter((p) => p.id !== authorId).map((p) => p.id);
}
