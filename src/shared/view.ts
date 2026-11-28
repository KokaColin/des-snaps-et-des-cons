/**
 * Ce que chaque joueur a le droit de voir. C'est la seule porte de sortie de l'état du jeu vers
 * les téléphones : tout ce qui n'est pas copié ici reste sur le serveur.
 *
 * - Création : chacun ne voit que sa photo et son brouillon ; des autres, seulement « a validé ».
 * - Vote : seul le meme affiché est envoyé, sans son auteur ; les notes des autres restent cachées.
 * - Résultats : auteurs, notes de chaque votant, Fauto reçues. Aucun total cumulé avant la fin.
 * - Fauto : le détenteur voit son gadget ; les autres seulement le nombre en circulation.
 */
import { isAbsent, startBlockers } from './engine';
import { availableTargets, fautoInCirculation, isWindowOpen, type HolderStatus } from './gadgets/fauto';
import type { MemeRecipe, TextLayer } from './meme';
import type { Assignment, FinalResults, GameState, Phase, PlayerId, PlayerKind, RoundResults } from './types';

export interface PlayerView {
  id: PlayerId;
  name: string;
  kind: PlayerKind;
  isHost: boolean;
  absent: boolean;
  ready: boolean;
  /** Création : a validé son meme. Vote : a noté le meme affiché. */
  done: boolean;
}

export interface GameView {
  code: string;
  me: PlayerId;
  phase: Phase;
  round: number;
  totalRounds: number;
  deadline: number | null;
  serverNow: number;
  players: PlayerView[];
  lobby: { blockers: string[]; maxPlayers: number; maxGuests: number } | null;
  creation: {
    assignment: Assignment;
    draft: TextLayer[] | null;
    submitted: boolean;
  } | null;
  vote: {
    index: number;
    count: number;
    meme: MemeRecipe;
    isMine: boolean;
    myNote: number | null;
  } | null;
  results: RoundResults | null;
  fauto: {
    inCirculation: number;
    windowOpen: boolean;
    mine: {
      status: HolderStatus;
      lockedUntilRound: number | null;
      offer: string[];
      targets: PlayerId[];
    } | null;
  };
  final: { results: FinalResults; rounds: RoundResults[] } | null;
  abortReason: string | null;
}

export function viewFor(state: GameState, me: PlayerId, now: number): GameView {
  const round = state.rounds.at(-1);
  const currentAuthor = state.phase === 'vote' && round ? round.voteOrder[round.voteCursor] : undefined;

  const players: PlayerView[] = state.players.map((p) => {
    let done = false;
    if (state.phase === 'creation' && round) done = Boolean(round.submitted[p.id]);
    if (state.phase === 'vote' && round && currentAuthor) {
      done = p.id === currentAuthor || round.votes[currentAuthor]?.[p.id] !== undefined;
    }
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      isHost: p.id === state.hostId,
      absent: isAbsent(state, p, now),
      ready: p.ready || p.id === state.hostId,
      done,
    };
  });

  const assignment = round?.assignments[me];
  const holder = state.gadgets.fauto.holders[me];

  return {
    code: state.code,
    me,
    phase: state.phase,
    round: state.round,
    totalRounds: state.config.rounds,
    deadline: state.deadline,
    serverNow: now,
    players,
    lobby:
      state.phase === 'lobby'
        ? { blockers: startBlockers(state), maxPlayers: state.config.maxPlayers, maxGuests: state.config.maxGuests }
        : null,
    creation:
      state.phase === 'creation' && round && assignment
        ? {
            assignment: { ...assignment },
            draft: round.drafts[me] ? structuredClone(round.drafts[me]) : null,
            submitted: Boolean(round.submitted[me]),
          }
        : null,
    vote:
      state.phase === 'vote' && round && currentAuthor
        ? {
            index: round.voteCursor,
            count: round.voteOrder.length,
            meme: structuredClone(round.memes[currentAuthor] as MemeRecipe),
            isMine: currentAuthor === me,
            myNote: round.votes[currentAuthor]?.[me] ?? null,
          }
        : null,
    results: state.phase === 'results' && round?.results ? structuredClone(round.results) : null,
    fauto: {
      inCirculation: fautoInCirculation(state),
      windowOpen: isWindowOpen(state),
      mine: holder
        ? {
            status: holder.status,
            lockedUntilRound: holder.lockedUntilRound,
            offer: [...holder.offer],
            targets: isWindowOpen(state) ? availableTargets(state, me) : [],
          }
        : null,
    },
    final:
      state.phase === 'final' && state.final
        ? {
            results: structuredClone(state.final),
            rounds: state.rounds.map((r) => structuredClone(r.results as RoundResults)),
          }
        : null,
    abortReason: state.abortReason,
  };
}
