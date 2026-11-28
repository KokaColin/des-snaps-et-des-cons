/**
 * Moteur de jeu de Des Snaps et des Cons.
 *
 * Fonctions pures sur un `GameState` sérialisable : aucune entrée/sortie, aucun accès à
 * l'horloge (l'heure `now` est toujours fournie), aléatoire déterministe stocké dans l'état.
 * Le serveur (Durable Object « Salon ») est le seul à appeler ces fonctions ; les clients
 * n'envoient que des actions, validées ici.
 *
 * Cycle : salon → [attribution → création → vote → résultats → chargement] × 3 → fin.
 */
import { DEFAULT_CONFIG, isMemberName, MEMBER_NAMES, type GameConfig, type MemberName } from './config';
import { ALL_GADGETS, GADGETS, type GadgetAction } from './gadgets';
import { initialFautoState } from './gadgets/fauto';
import { sanitizeLayers } from './meme';
import { drawPhotos } from './photos';
import { shuffle } from './rng';
import { computeFinalResults, computeRoundResults } from './scoring';
import type { Assignment, GameState, LibrarySnapshot, Player, PlayerId, RoundState } from './types';

export type Result = { ok: true } | { ok: false; error: string };
const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

export type Action =
  | { type: 'ready'; ready: boolean }
  | { type: 'kick'; playerId: PlayerId }
  | { type: 'start' }
  | { type: 'draft'; layers: unknown }
  | { type: 'submit'; layers: unknown }
  | { type: 'reroll' }
  /**
   * Note du meme affiché. Le client ne connaît pas l'auteur (vote anonyme) : il désigne le meme
   * par sa position dans l'ordre de passage, pour qu'une note en retard ne tombe pas sur le suivant.
   */
  | { type: 'vote'; index: number; note: number }
  | ({ type: 'gadget' } & GadgetAction)
  | { type: 'rematch' };

const IN_GAME_PHASES = new Set(['creation', 'vote', 'results', 'loading']);

// ---------------------------------------------------------------------------------------------
// Création et salon
// ---------------------------------------------------------------------------------------------

export function createGame(opts: {
  code: string;
  now: number;
  seed: number;
  config?: Partial<GameConfig>;
}): GameState {
  return {
    version: 1,
    code: opts.code,
    config: { ...DEFAULT_CONFIG, ...opts.config },
    rng: { seed: opts.seed | 0 },
    phase: 'lobby',
    phaseStartedAt: opts.now,
    deadline: null,
    players: [],
    hostId: null,
    round: 0,
    rounds: [],
    library: { iconic: [], fauto: [] },
    usedPhotoIds: [],
    gadgets: { fauto: initialFautoState() },
    lowConnectivitySince: null,
    final: null,
    abortReason: null,
  };
}

export type JoinRequest =
  | { id: PlayerId; kind: 'member'; member: MemberName }
  | { id: PlayerId; kind: 'guest'; name: string };

export const countMembers = (s: GameState) => s.players.filter((p) => p.kind === 'member').length;
export const countGuests = (s: GameState) => s.players.filter((p) => p.kind === 'guest').length;

export function normalizeGuestName(raw: string, config: GameConfig): string | null {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length === 0 || [...name].length > config.guestNameMaxLength) return null;
  return name;
}

/** Ajoute un joueur au salon. Le premier joueur devient l'organisateur et doit être membre. */
export function addPlayer(state: GameState, req: JoinRequest, now: number): Result {
  if (state.phase !== 'lobby') return fail('game_started');
  if (state.players.some((p) => p.id === req.id)) return fail('already_joined');
  if (state.players.length >= state.config.maxPlayers) return fail('room_full');

  let name: string;
  let member: MemberName | null = null;
  if (req.kind === 'member') {
    if (!isMemberName(req.member)) return fail('unknown_member');
    if (state.players.some((p) => p.member === req.member)) return fail('name_taken');
    name = req.member;
    member = req.member;
  } else {
    if (state.players.length === 0) return fail('host_must_be_member');
    const clean = normalizeGuestName(req.name, state.config);
    if (!clean) return fail('invalid_name');
    const lower = clean.toLocaleLowerCase('fr');
    const clash =
      state.players.some((p) => p.name.toLocaleLowerCase('fr') === lower) ||
      MEMBER_NAMES.some((m) => m.toLocaleLowerCase('fr') === lower);
    if (clash) return fail('name_taken');
    if (countGuests(state) >= state.config.maxGuests) return fail('too_many_guests');
    // Toujours strictement plus de membres que d'invités.
    if (countMembers(state) <= countGuests(state) + 1) return fail('not_enough_members');
    name = clean;
  }

  state.players.push({
    id: req.id,
    name,
    kind: req.kind,
    member,
    joinedAt: now,
    connected: true,
    lastSeenAt: now,
    disconnectedAt: null,
    ready: false,
  });
  if (state.hostId === null) state.hostId = req.id;
  return OK;
}

/** Retire un joueur du salon (départ volontaire ou exclusion). Impossible une fois lancé. */
export function removePlayer(state: GameState, playerId: PlayerId): Result {
  if (state.phase !== 'lobby') return fail('game_started');
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index < 0) return fail('unknown_player');
  state.players.splice(index, 1);
  if (state.hostId === playerId) state.hostId = pickNewHost(state);
  return OK;
}

/** Organisateur suivant : le plus ancien joueur connecté, membre de préférence. */
function pickNewHost(state: GameState): PlayerId | null {
  const connected = state.players.filter((p) => p.connected);
  return (
    connected.find((p) => p.kind === 'member')?.id ??
    connected[0]?.id ??
    state.players.find((p) => p.kind === 'member')?.id ??
    state.players[0]?.id ??
    null
  );
}

export function setLibrary(state: GameState, library: LibrarySnapshot): void {
  state.library = library;
}

/** Signale une connexion, une déconnexion ou un signe de vie d'un joueur. */
export function setConnection(state: GameState, playerId: PlayerId, connected: boolean, now: number): Result {
  const player = findPlayer(state, playerId);
  if (!player) return fail('unknown_player');
  player.lastSeenAt = now;
  if (player.connected !== connected) {
    player.connected = connected;
    player.disconnectedAt = connected ? null : now;
  }
  if (!connected && state.hostId === playerId) {
    const next = pickNewHost(state);
    if (next) state.hostId = next;
  }
  if (state.hostId === null || !findPlayer(state, state.hostId)) state.hostId = pickNewHost(state);
  updateConnectivity(state, now);
  return OK;
}

/**
 * Signe de vie sans action (ping du téléphone), daté par le serveur. Ne fait jamais reculer
 * `lastSeenAt` : un ping ancien reçu après une action récente est ignoré.
 */
export function heartbeat(state: GameState, playerId: PlayerId, at: number): Result {
  const player = findPlayer(state, playerId);
  if (!player) return fail('unknown_player');
  if (at > player.lastSeenAt) player.lastSeenAt = at;
  return OK;
}

// ---------------------------------------------------------------------------------------------
// Actions des joueurs
// ---------------------------------------------------------------------------------------------

export function dispatch(state: GameState, playerId: PlayerId, action: Action, now: number): Result {
  const player = findPlayer(state, playerId);
  if (!player) return fail('unknown_player');
  player.lastSeenAt = now;

  switch (action.type) {
    case 'ready':
      if (state.phase !== 'lobby') return fail('wrong_phase');
      player.ready = Boolean(action.ready);
      return OK;

    case 'kick':
      if (state.phase !== 'lobby') return fail('wrong_phase');
      if (state.hostId !== playerId) return fail('not_host');
      if (action.playerId === playerId) return fail('cannot_kick_self');
      return removePlayer(state, action.playerId);

    case 'start':
      return start(state, playerId, now);

    case 'draft':
    case 'submit': {
      if (state.phase !== 'creation') return fail('wrong_phase');
      const round = currentRound(state);
      if (round.submitted[playerId]) return fail('already_submitted');
      const layers = sanitizeLayers(action.layers, state.config);
      if (!layers) return fail('invalid_meme');
      round.drafts[playerId] = layers;
      if (action.type === 'submit') {
        round.submitted[playerId] = true;
        maybeEndCreationEarly(state, now);
      }
      return OK;
    }

    case 'reroll':
      return reroll(state, playerId);

    case 'vote':
      return vote(state, playerId, action.index, action.note, now);

    case 'gadget': {
      const { gadget, ...rest } = action;
      if (typeof gadget !== 'string' || !Object.hasOwn(GADGETS, gadget)) return fail('unknown_gadget');
      const module = GADGETS[gadget];
      return module.handle(state, playerId, rest as never);
    }

    case 'rematch':
      if (state.phase !== 'final') return fail('wrong_phase');
      if (state.hostId !== playerId) return fail('not_host');
      resetToLobby(state, now);
      return OK;

    default:
      return fail('unknown_action');
  }
}

/** Raisons qui empêchent le lancement (liste vide = lancement possible). */
export function startBlockers(state: GameState): string[] {
  const c = state.config;
  const blockers: string[] = [];
  const n = state.players.length;
  if (n < c.minPlayers) blockers.push('not_enough_players');
  if (n > c.maxPlayers) blockers.push('too_many_players');
  if (countMembers(state) <= countGuests(state)) blockers.push('not_enough_members');
  if (state.players.some((p) => !p.connected)) blockers.push('players_absent');
  // L'organisateur est compté prêt d'office : il n'a qu'un bouton « Lancer la partie ».
  if (state.players.some((p) => p.id !== state.hostId && !p.ready)) blockers.push('players_not_ready');
  if (state.library.iconic.length < n * c.minIconicPerPlayer) blockers.push('not_enough_photos');
  return blockers;
}

function start(state: GameState, playerId: PlayerId, now: number): Result {
  if (state.phase !== 'lobby') return fail('wrong_phase');
  if (state.hostId !== playerId) return fail('not_host');
  const blockers = startBlockers(state);
  if (blockers.length > 0) return fail(blockers[0] as string);
  startRound(state, now);
  return OK;
}

function reroll(state: GameState, playerId: PlayerId): Result {
  if (state.phase !== 'creation') return fail('wrong_phase');
  const round = currentRound(state);
  const assignment = round.assignments[playerId];
  if (!assignment) return fail('unknown_player');
  if (round.submitted[playerId]) return fail('already_submitted');
  if (assignment.imposedBy) return fail('reroll_imposed');
  if (assignment.rerolled) return fail('reroll_used');
  const inRound = new Set(Object.values(round.assignments).map((a) => a.photoId));
  const [photoId] = drawPhotos(state.rng, state.library.iconic, 1, new Set(state.usedPhotoIds), inRound);
  if (!photoId) return fail('no_photo_left');
  round.assignments[playerId] = { ...assignment, photoId, rerolled: true };
  state.usedPhotoIds.push(photoId);
  return OK;
}

function vote(state: GameState, voterId: PlayerId, index: number, note: number, now: number): Result {
  if (state.phase !== 'vote') return fail('wrong_phase');
  const round = currentRound(state);
  const authorId = round.voteOrder[round.voteCursor];
  if (index !== round.voteCursor || !authorId) return fail('not_current_meme');
  if (voterId === authorId) return fail('own_meme');
  if (!Number.isInteger(note) || note < 0 || note > state.config.maxNote) return fail('invalid_note');
  const votes = (round.votes[authorId] ??= {});
  if (votes[voterId] !== undefined) return fail('already_voted');
  votes[voterId] = note;
  if (currentMemeFullyVoted(state)) advanceVote(state, now);
  return OK;
}

// ---------------------------------------------------------------------------------------------
// Temps : passage automatique d'une phase à l'autre
// ---------------------------------------------------------------------------------------------

/** À appeler régulièrement (alarme du serveur). Renvoie true si l'état a changé. */
export function tick(state: GameState, now: number): boolean {
  const before = `${state.phase}:${state.round}:${state.rounds.at(-1)?.voteCursor}:${state.deadline}`;
  updateConnectivity(state, now);
  if (state.phase === 'aborted') return true;

  // Plusieurs échéances peuvent être dépassées d'un coup (serveur endormi) : on rattrape.
  for (let guard = 0; guard < 50; guard++) {
    if (state.phase === 'creation') maybeEndCreationEarly(state, now);
    if (state.phase === 'vote' && currentMemeFullyVoted(state)) advanceVote(state, now);
    if (state.deadline === null || now < state.deadline) break;
    onDeadline(state, state.deadline);
  }
  const after = `${state.phase}:${state.round}:${state.rounds.at(-1)?.voteCursor}:${state.deadline}`;
  return before !== after;
}

/** Prochain instant où `tick` aura quelque chose à faire (pour programmer l'alarme). */
export function nextWakeAt(state: GameState): number | null {
  const candidates: number[] = [];
  if (state.deadline !== null) candidates.push(state.deadline);
  if (state.lowConnectivitySince !== null) {
    candidates.push(state.lowConnectivitySince + state.config.abandonAfterMs);
  }
  if (state.phase === 'creation') {
    const round = currentRound(state);
    for (const p of state.players) {
      if (!round.submitted[p.id] && p.disconnectedAt !== null) {
        candidates.push(p.disconnectedAt + state.config.creationGraceMs);
      }
    }
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function onDeadline(state: GameState, at: number): void {
  switch (state.phase) {
    case 'creation':
      endCreation(state, at);
      break;
    case 'vote':
      advanceVote(state, at);
      break;
    case 'results':
      endResults(state, at);
      break;
    case 'loading':
      startRound(state, at);
      break;
    default:
      state.deadline = null;
  }
}

function setPhase(state: GameState, phase: GameState['phase'], now: number, durationMs: number | null): void {
  state.phase = phase;
  state.phaseStartedAt = now;
  state.deadline = durationMs === null ? null : now + durationMs;
}

function startRound(state: GameState, now: number): void {
  state.round += 1;
  const imposed: Record<PlayerId, { photoId: string; by: PlayerId }> = {};
  for (const gadget of ALL_GADGETS) Object.assign(imposed, gadget.imposedPhotos(state, state.round));

  const assignments: Record<PlayerId, Assignment> = {};
  const free = state.players.filter((p) => !imposed[p.id]);
  const drawn = drawPhotos(state.rng, state.library.iconic, free.length, new Set(state.usedPhotoIds));
  free.forEach((p, i) => {
    const photoId = drawn[i];
    if (!photoId) throw new Error('Photothèque insuffisante');
    assignments[p.id] = { photoId, category: 'iconic', imposedBy: null, rerolled: false };
  });
  for (const [playerId, imp] of Object.entries(imposed)) {
    if (findPlayer(state, playerId)) {
      assignments[playerId] = { photoId: imp.photoId, category: 'fauto', imposedBy: imp.by, rerolled: false };
    }
  }
  state.usedPhotoIds.push(...Object.values(assignments).map((a) => a.photoId));

  const round: RoundState = {
    index: state.round,
    assignments,
    drafts: {},
    submitted: {},
    memes: {},
    voteOrder: [],
    voteCursor: 0,
    votes: {},
    results: null,
  };
  state.rounds.push(round);
  setPhase(state, 'creation', now, state.config.creationMs);
}

/**
 * Fin anticipée de la création : tout le monde a validé, ou tous les joueurs connectés ont validé
 * et les autres sont absents depuis assez longtemps pour ne plus être attendus.
 */
function maybeEndCreationEarly(state: GameState, now: number): void {
  const round = currentRound(state);
  const waiting = state.players.filter((p) => !round.submitted[p.id]);
  const stillExpected = waiting.some(
    (p) => p.connected || p.disconnectedAt === null || now - p.disconnectedAt < state.config.creationGraceMs,
  );
  if (!stillExpected) endCreation(state, now);
}

/** Fige les memes (les non validés partent tels quels, image seule s'ils sont vides). */
function endCreation(state: GameState, now: number): void {
  const round = currentRound(state);
  for (const p of state.players) {
    const assignment = round.assignments[p.id];
    if (!assignment) continue;
    round.memes[p.id] = { photoId: assignment.photoId, layers: round.drafts[p.id] ?? [] };
  }
  round.voteOrder = shuffle(state.rng, Object.keys(round.memes));
  round.voteCursor = 0;
  setPhase(state, 'vote', now, state.config.votePerMemeMs);
}

/** Tous les votants attendus (connectés, hors auteur) ont noté le meme affiché. */
function currentMemeFullyVoted(state: GameState): boolean {
  const round = currentRound(state);
  const authorId = round.voteOrder[round.voteCursor];
  if (!authorId) return true;
  const votes = round.votes[authorId] ?? {};
  return state.players.every((p) => p.id === authorId || !p.connected || votes[p.id] !== undefined);
}

function advanceVote(state: GameState, now: number): void {
  const round = currentRound(state);
  round.voteCursor += 1;
  if (round.voteCursor < round.voteOrder.length) {
    setPhase(state, 'vote', now, state.config.votePerMemeMs);
    return;
  }
  round.results = computeRoundResults(round, state.config);
  state.phase = 'results';
  for (const gadget of ALL_GADGETS) gadget.onResultsStart(state);
  const longer = ALL_GADGETS.some((g) => g.wantsLongerResults(state));
  setPhase(state, 'results', now, longer ? state.config.resultsWithGadgetMs : state.config.resultsMs);
}

function endResults(state: GameState, now: number): void {
  for (const gadget of ALL_GADGETS) gadget.onResultsEnd(state);
  if (state.round < state.config.rounds) {
    setPhase(state, 'loading', now, state.config.loadingMs);
  } else {
    state.final = computeFinalResults(state);
    setPhase(state, 'final', now, null);
  }
}

/** Partie arrêtée si trop peu de joueurs restent connectés trop longtemps. */
function updateConnectivity(state: GameState, now: number): void {
  if (!IN_GAME_PHASES.has(state.phase)) {
    state.lowConnectivitySince = null;
    return;
  }
  const connected = state.players.filter((p) => p.connected).length;
  if (connected >= state.config.minConnected) {
    state.lowConnectivitySince = null;
    return;
  }
  state.lowConnectivitySince ??= now;
  if (now - state.lowConnectivitySince >= state.config.abandonAfterMs) {
    state.abortReason = 'not_enough_connected';
    setPhase(state, 'aborted', now, null);
  }
}

function resetToLobby(state: GameState, now: number): void {
  state.round = 0;
  state.rounds = [];
  state.usedPhotoIds = [];
  state.gadgets = { fauto: initialFautoState() };
  state.final = null;
  state.abortReason = null;
  state.lowConnectivitySince = null;
  for (const p of state.players) p.ready = false;
  setPhase(state, 'lobby', now, null);
}

// ---------------------------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------------------------

export function findPlayer(state: GameState, id: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function currentRound(state: GameState): RoundState {
  const round = state.rounds.at(-1);
  if (!round) throw new Error('Aucune manche en cours');
  return round;
}

export function isAbsent(state: GameState, player: Player, now: number): boolean {
  return !player.connected || now - player.lastSeenAt > state.config.absentAfterMs;
}
