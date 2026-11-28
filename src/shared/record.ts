/**
 * Ce qu'on garde d'une partie terminée (pour les profils, la galerie légendaire et l'historique).
 * Construit à partir de l'état final du moteur ; les parties arrêtées ne sont jamais enregistrées.
 */
import type { MemberName } from './config';
import type { Fraction } from './fraction';
import type { TextLayer } from './meme';
import type { GameState, PlayerKind } from './types';

export interface RecordedPlayer {
  id: string;
  name: string;
  kind: PlayerKind;
  member: MemberName | null;
  rank: number;
  total: Fraction;
  roundsWon: number;
  averageGiven: Fraction | null;
  badges: ('goofy' | 'broke' | 'shame')[];
}

export interface RecordedMeme {
  round: number;
  authorId: string;
  photoId: string;
  layers: TextLayer[];
  /** Notes réelles, par identifiant de votant (voir `players` pour les noms). */
  votes: Record<string, number>;
  score: Fraction;
  legendary: boolean;
  imposedBy: string | null;
}

export interface GameRecord {
  code: string;
  startedAt: number;
  endedAt: number;
  players: RecordedPlayer[];
  memes: RecordedMeme[];
}

export function buildGameRecord(state: GameState, startedAt: number, endedAt: number): GameRecord | null {
  if (state.phase !== 'final' || !state.final) return null;
  const final = state.final;
  const players: RecordedPlayer[] = state.players.map((p) => {
    const s = final.standings.find((x) => x.playerId === p.id);
    if (!s) throw new Error(`Classement manquant pour ${p.id}`);
    const badges = (['goofy', 'broke', 'shame'] as const).filter((b) => final.badges[b].includes(p.id));
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      member: p.member,
      rank: s.rank,
      total: s.total,
      roundsWon: s.roundsWon,
      averageGiven: s.averageGiven,
      badges,
    };
  });
  const memes: RecordedMeme[] = state.rounds.flatMap((round) =>
    (round.results?.memes ?? []).map((m) => ({
      round: round.index,
      authorId: m.authorId,
      photoId: m.recipe.photoId,
      layers: m.recipe.layers,
      votes: { ...m.votes },
      score: m.score,
      legendary: m.legendary,
      imposedBy: m.imposedBy,
    })),
  );
  return { code: state.code, startedAt, endedAt, players, memes };
}
