import { DurableObject } from 'cloudflare:workers';
import { isMemberName, type MemberName } from '../shared/config';
import {
  addPlayer,
  createGame,
  dispatch,
  findPlayer,
  heartbeat,
  isAbsent,
  nextWakeAt,
  removePlayer,
  setConnection,
  setLibrary,
  tick,
  type Action,
  type Result,
} from '../shared/engine';
import { CLOSE_FINAL, CLOSE_SILENT, PING, PONG, type ByeReason, type ClientMessage, type RoomInfo, type ServerMessage } from '../shared/protocol';
import { buildGameRecord } from '../shared/record';
import type { GameState, PlayerId } from '../shared/types';
import { viewFor } from '../shared/view';
import { groupStub, type Env } from './env';
import { randomToken, sha256Hex } from './lib/crypto';

/** Partie supprimée après 2 h sans aucune action ni connexion. */
const EXPIRE_AFTER_MS = 2 * 3600_000;
/** Contrôle de présence tant que des téléphones sont connectés. */
const PRESENCE_EVERY_MS = 3_000;
/** Connexion muette (ni ping ni message) au-delà de ce délai : fermée, le joueur passe déconnecté. */
const DROP_SILENT_AFTER_MS = 20_000;

interface Meta {
  code: string;
  /** Membre qui a créé la partie : il doit entrer le premier (il devient l'organisateur). */
  creator: MemberName;
  createdAt: number;
  lastActivityAt: number;
  /** Début de la partie en cours (sortie du salon), null au salon. */
  gameStartedAt?: number | null;
  /** La partie terminée a été enregistrée dans `Group` (remis à faux à la revanche). */
  recorded?: boolean;
}

/** Infos attachées à chaque connexion (survivent à l'hibernation). */
interface Attachment {
  /** Null tant que le téléphone ne s'est pas présenté (message « hello »). */
  playerId: PlayerId | null;
  /** Membre connecté, vérifié par le Worker à partir du cookie de session. */
  member: MemberName | null;
  openedAt: number;
  lastMessageAt: number;
}

/** Délai pour se présenter après l'ouverture de la connexion. */
const HELLO_TIMEOUT_MS = 10_000;

type Join =
  | { ok: true; playerId: PlayerId; token?: string }
  | { ok: false; reason: ByeReason; error?: string };

/**
 * Une partie = un Durable Object.
 *
 * - WebSocket avec hibernation : l'objet peut s'endormir entre deux messages sans couper les
 *   téléphones. Les pings (« ping » → « pong ») sont traités par Cloudflare sans le réveiller.
 * - L'état du moteur est enregistré en SQLite à chaque changement : un réveil reprend exactement
 *   là où la partie en était.
 * - Une seule alarme, réglée sur l'échéance la plus proche : chrono du moteur (`nextWakeAt`),
 *   contrôle de présence, expiration.
 * - Chaque joueur ne reçoit que `viewFor()` : rien d'autre ne sort de l'objet.
 */
export class GameRoom extends DurableObject<Env> {
  private readonly sql: SqlStorage;
  private meta: Meta | null = null;
  private state: GameState | null = null;
  /** Dernier état enregistré (JSON), pour n'écrire et ne diffuser que les vrais changements. */
  private saved = '';
  /** Joueurs absents lors de la dernière diffusion. */
  private lastAbsent = '';
  /** Joueurs partis d'eux-mêmes (pour leur dire « left » plutôt que « kicked »). */
  private readonly leaving = new Set<PlayerId>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ensureTables();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    this.load();
  }

  // -------------------------------------------------------------------------------------------
  // RPC (appelé par le Worker)
  // -------------------------------------------------------------------------------------------

  /** Crée la partie si ce code est libre. Renvoie false si une partie vivante l'utilise déjà. */
  async init(code: string, creator: MemberName): Promise<boolean> {
    const now = Date.now();
    if (this.isLive(now)) return false;
    if (this.meta) await this.wipe();
    this.ensureTables();
    const seed = crypto.getRandomValues(new Int32Array(1))[0] ?? 1;
    this.meta = { code, creator, createdAt: now, lastActivityAt: now };
    this.state = createGame({ code, now, seed });
    await this.refreshLibrary();
    this.persist();
    await this.schedule(now);
    return true;
  }

  async info(): Promise<RoomInfo> {
    const live = this.isLive(Date.now());
    return {
      exists: live,
      phase: live ? (this.state?.phase ?? null) : null,
      players: live ? (this.state?.players.length ?? 0) : 0,
    };
  }

  // -------------------------------------------------------------------------------------------
  // Connexions
  // -------------------------------------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
    const memberHeader = request.headers.get('X-Member');
    const now = Date.now();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      playerId: null,
      member: isMemberName(memberHeader) ? memberHeader : null,
      openedAt: now,
      lastMessageAt: now,
    } satisfies Attachment);
    if (!this.isLive(now)) {
      this.refuse(server, { ok: false, reason: 'room_not_found' });
    } else {
      await this.schedule(now); // pour fermer la connexion si elle ne se présente pas
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Message « hello » : on identifie le joueur et on l'ajoute (ou le rattache) à la partie. */
  private async hello(ws: WebSocket, att: Attachment, msg: { token?: unknown; name?: unknown }, now: number): Promise<void> {
    const token = typeof msg.token === 'string' ? msg.token : null;
    const name = typeof msg.name === 'string' ? msg.name : null;
    const join = await this.resolveJoin(att.member, token, name, now);
    if (!join.ok || !this.state) {
      this.refuse(ws, join.ok ? { ok: false, reason: 'room_not_found' } : join);
      return;
    }
    ws.serializeAttachment({ ...att, playerId: join.playerId, lastMessageAt: now } satisfies Attachment);
    send(ws, { t: 'welcome', playerId: join.playerId, ...(join.token ? { token: join.token } : {}) });
    const used = this.state.usedPhotoIds.length;
    setConnection(this.state, join.playerId, true, now);
    this.touch(now);
    // Le nouveau venu doit recevoir la vue même si rien d'autre n'a changé.
    await this.commit(now, used, true);
  }

  private refuse(ws: WebSocket, join: Extract<Join, { ok: false }>): void {
    if (join.error) send(ws, { t: 'error', error: join.error });
    send(ws, { t: 'bye', reason: join.reason });
    try {
      ws.close(CLOSE_FINAL, 'refus');
    } catch {
      // déjà fermée
    }
  }

  /** Identifie le joueur : jeton de l'appareil, puis membre connecté, puis nouvel arrivant. */
  private async resolveJoin(member: MemberName | null, token: string | null, name: string | null, now: number): Promise<Join> {
    if (!this.isLive(now) || !this.state || !this.meta) return { ok: false, reason: 'room_not_found' };

    if (token) {
      const row = this.sql.exec('SELECT player_id FROM tokens WHERE token_hash = ?', await sha256Hex(token)).toArray()[0];
      const id = row ? String(row.player_id) : null;
      if (id && findPlayer(this.state, id)) return { ok: true, playerId: id };
    }

    if (member) {
      // Même membre sur un autre appareil : il reprend sa place.
      const existing = this.state.players.find((p) => p.member === member);
      if (existing) return { ok: true, playerId: existing.id, token: await this.issueToken(existing.id) };
    }

    if (token && !member && !name) return { ok: false, reason: 'invalid_token' };
    if (this.state.phase !== 'lobby') return { ok: false, reason: 'join_refused', error: 'game_started' };
    if (this.state.players.length === 0 && member !== this.meta.creator) return { ok: false, reason: 'waiting_for_host' };
    if (!member && !name) return { ok: false, reason: 'need_name' };

    await this.refreshLibrary();
    if (!this.state) return { ok: false, reason: 'room_not_found' };
    const id = randomToken(9);
    const result = addPlayer(
      this.state,
      member ? { id, kind: 'member', member } : { id, kind: 'guest', name: name ?? '' },
      now,
    );
    if (!result.ok) return { ok: false, reason: 'join_refused', error: result.error };
    return { ok: true, playerId: id, token: await this.issueToken(id) };
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || typeof message !== 'string') return;
    const now = Date.now();
    if (!this.state) {
      this.refuse(ws, { ok: false, reason: 'room_not_found' });
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message) as ClientMessage;
    } catch {
      send(ws, { t: 'error', error: 'bad_message' });
      return;
    }
    if (att.playerId === null) {
      if (msg?.t === 'hello') await this.hello(ws, att, msg, now);
      else send(ws, { t: 'error', error: 'hello_first' });
      return;
    }
    ws.serializeAttachment({ ...att, lastMessageAt: now } satisfies Attachment);
    this.touch(now);
    const used = this.state.usedPhotoIds.length;
    let result: Result = { ok: true };

    if (msg?.t === 'leave') {
      result = removePlayer(this.state, att.playerId);
      if (result.ok) this.leaving.add(att.playerId);
    } else if (msg?.t === 'action' && msg.action && typeof (msg.action as { type?: unknown }).type === 'string') {
      if (this.state.phase === 'lobby') await this.refreshLibrary();
      result = this.safeDispatch(att.playerId, msg.action, now);
    } else {
      result = { ok: false, error: 'bad_message' };
    }

    if (!result.ok) send(ws, { t: 'error', error: result.error });
    await this.commit(now, used);
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code >= 3000 && code <= 4999 ? code : 1000, 'fin');
    } catch {
      // déjà fermée
    }
    await this.socketGone(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.socketGone(ws);
  }

  override async alarm(): Promise<void> {
    if (!this.meta || !this.state) return;
    const now = Date.now();
    if (now >= this.meta.lastActivityAt + EXPIRE_AFTER_MS) {
      await this.expire();
      return;
    }
    const used = this.state.usedPhotoIds.length;
    this.checkPresence(now);
    await this.commit(now, used);
  }

  // -------------------------------------------------------------------------------------------
  // Mécanique interne
  // -------------------------------------------------------------------------------------------

  /** Le moteur ne doit jamais casser l'objet : en cas d'erreur, on revient au dernier état enregistré. */
  private safeDispatch(playerId: PlayerId, action: Action, now: number): Result {
    if (!this.state) return { ok: false, error: 'room_not_found' };
    try {
      return dispatch(this.state, playerId, action, now);
    } catch (e) {
      console.error('GameRoom dispatch', e);
      this.load();
      return { ok: false, error: 'server_error' };
    }
  }

  private async socketGone(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || att.playerId === null || !this.state) return;
    const now = Date.now();
    const stillThere = this.openSockets(att.playerId).some((s) => s !== ws);
    if (stillThere || !findPlayer(this.state, att.playerId)) return;
    const used = this.state.usedPhotoIds.length;
    setConnection(this.state, att.playerId, false, now);
    await this.commit(now, used);
  }

  /**
   * Met à jour les signes de vie à partir des pings, et ferme les connexions muettes depuis trop
   * longtemps (téléphone verrouillé, réseau coupé sans fermeture propre).
   */
  private checkPresence(now: number): void {
    if (!this.state) return;
    const lastSeen = new Map<PlayerId, number>();
    const silent: WebSocket[] = [];
    for (const ws of this.openSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att) continue;
      if (att.playerId === null) {
        if (now - att.openedAt > HELLO_TIMEOUT_MS) silent.push(ws);
        continue;
      }
      const ping = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      const seen = Math.max(ping, att.lastMessageAt);
      if (now - seen > DROP_SILENT_AFTER_MS) {
        silent.push(ws);
        continue;
      }
      lastSeen.set(att.playerId, Math.max(lastSeen.get(att.playerId) ?? 0, seen));
    }
    for (const [playerId, seen] of lastSeen) heartbeat(this.state, playerId, seen);
    // Joueur « connecté » sans aucune connexion ouverte : c'est arrivé après un redémarrage de
    // l'objet (mise en ligne d'une nouvelle version), qui coupe les connexions sans prévenir.
    // Sans ça, il resterait connecté à vie et bloquerait les votes et l'arrêt de partie.
    for (const p of this.state.players) {
      if (p.connected && !lastSeen.has(p.id) && now - p.lastSeenAt > DROP_SILENT_AFTER_MS) {
        setConnection(this.state, p.id, false, now);
      }
    }
    for (const ws of silent) {
      const att = ws.deserializeAttachment() as Attachment;
      try {
        ws.close(CLOSE_SILENT, 'silence');
      } catch {
        // déjà fermée
      }
      if (att.playerId !== null && !lastSeen.has(att.playerId) && findPlayer(this.state, att.playerId)) {
        setConnection(this.state, att.playerId, false, now);
      }
    }
  }

  /** Après chaque événement : faire avancer le moteur, enregistrer, diffuser, reprogrammer l'alarme. */
  private async commit(now: number, usedBefore: number, forceBroadcast = false): Promise<void> {
    if (!this.state) return;
    tick(this.state, now);
    this.dropRemovedPlayers();

    const json = JSON.stringify(this.state);
    const changed = json !== this.saved;
    if (changed) this.persist(json);
    if (changed || forceBroadcast || this.absentSignature(now) !== this.lastAbsent) this.broadcast(now);

    // Photos distribuées : on met à jour la photothèque (priorité aux moins jouées).
    const newlyUsed = this.state.usedPhotoIds.slice(usedBefore);
    if (newlyUsed.length > 0) {
      groupStub(this.env)
        .markPlayed(newlyUsed, now)
        .catch((e: unknown) => console.error('markPlayed', e));
    }
    await this.trackGame(now);
    await this.schedule(now);
  }

  /** Début et fin de partie : la partie terminée est enregistrée une seule fois dans `Group`. */
  private async trackGame(now: number): Promise<void> {
    const meta = this.meta;
    const state = this.state;
    if (!meta || !state) return;
    let changed = false;
    if (state.phase === 'lobby') {
      changed = meta.gameStartedAt != null || meta.recorded === true;
      meta.gameStartedAt = null;
      meta.recorded = false;
    } else if (meta.gameStartedAt == null) {
      meta.gameStartedAt = now;
      changed = true;
    }
    if (state.phase === 'final' && !meta.recorded) {
      const record = buildGameRecord(state, meta.gameStartedAt ?? now, state.phaseStartedAt);
      if (record) {
        try {
          await groupStub(this.env).recordGame(record);
          meta.recorded = true;
          changed = true;
        } catch (e) {
          // Nouvel essai au prochain événement (alarme de présence, message…).
          console.error('recordGame', e);
        }
      }
    }
    if (changed) this.sql.exec('INSERT OR REPLACE INTO room (key, value) VALUES (?, ?)', 'meta', JSON.stringify(meta));
  }

  private broadcast(now: number): void {
    if (!this.state) return;
    this.lastAbsent = this.absentSignature(now);
    for (const ws of this.openSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId || !findPlayer(this.state, att.playerId)) continue;
      send(ws, { t: 'view', view: viewFor(this.state, att.playerId, now) });
    }
  }

  /** Joueurs retirés du salon (départ ou exclusion) : on ferme leurs connexions et on oublie leurs jetons. */
  private dropRemovedPlayers(): void {
    if (!this.state) return;
    const state = this.state;
    for (const ws of this.openSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.playerId || findPlayer(state, att.playerId)) continue;
      send(ws, { t: 'bye', reason: this.leaving.has(att.playerId) ? 'left' : 'kicked' });
      try {
        ws.close(CLOSE_FINAL, 'retiré');
      } catch {
        // déjà fermée
      }
      this.sql.exec('DELETE FROM tokens WHERE player_id = ?', att.playerId);
    }
    this.leaving.clear();
  }

  private absentSignature(now: number): string {
    if (!this.state) return '';
    const state = this.state;
    return state.players
      .filter((p) => isAbsent(state, p, now))
      .map((p) => p.id)
      .join(',');
  }

  private async schedule(now: number): Promise<void> {
    if (!this.meta || !this.state) return;
    const candidates = [this.meta.lastActivityAt + EXPIRE_AFTER_MS];
    const wake = nextWakeAt(this.state);
    if (wake !== null) candidates.push(wake);
    if (this.openSockets().length > 0) candidates.push(now + PRESENCE_EVERY_MS);
    await this.ctx.storage.setAlarm(Math.max(now + 10, Math.min(...candidates)));
  }

  private async refreshLibrary(): Promise<void> {
    try {
      const library = await groupStub(this.env).library();
      if (this.state?.phase === 'lobby') setLibrary(this.state, library);
    } catch (e) {
      console.error('GameRoom library', e);
    }
  }

  private async expire(): Promise<void> {
    for (const ws of this.openSockets()) {
      send(ws, { t: 'bye', reason: 'expired' });
      try {
        ws.close(CLOSE_FINAL, 'expirée');
      } catch {
        // déjà fermée
      }
    }
    await this.wipe();
  }

  private async wipe(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    this.state = null;
    this.saved = '';
    this.lastAbsent = '';
    this.ensureTables();
  }

  /** Activité dans la partie : repousse l'expiration (enregistrée à part de l'état du jeu). */
  private touch(now: number): void {
    if (!this.meta) return;
    this.meta.lastActivityAt = now;
    this.sql.exec('INSERT OR REPLACE INTO room (key, value) VALUES (?, ?)', 'meta', JSON.stringify(this.meta));
  }

  private isLive(now: number): boolean {
    return this.meta !== null && this.state !== null && now < this.meta.lastActivityAt + EXPIRE_AFTER_MS;
  }

  /** Jeton de l'appareil (seul son haché est stocké). */
  private async issueToken(playerId: PlayerId): Promise<string> {
    const token = randomToken();
    this.sql.exec('INSERT OR REPLACE INTO tokens (token_hash, player_id) VALUES (?, ?)', await sha256Hex(token), playerId);
    return token;
  }

  /** Connexions ouvertes, éventuellement limitées à un joueur. */
  private openSockets(playerId?: PlayerId): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      if (ws.readyState !== WebSocket.OPEN) return false;
      if (playerId === undefined) return true;
      return (ws.deserializeAttachment() as Attachment | null)?.playerId === playerId;
    });
  }

  private ensureTables(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS room (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL);
    `);
  }

  private load(): void {
    this.meta = null;
    this.state = null;
    for (const row of this.sql.exec('SELECT key, value FROM room')) {
      if (row.key === 'meta') this.meta = JSON.parse(String(row.value)) as Meta;
      if (row.key === 'state') {
        this.saved = String(row.value);
        this.state = JSON.parse(this.saved) as GameState;
      }
    }
  }

  private persist(json = this.state ? JSON.stringify(this.state) : ''): void {
    if (!this.meta || !this.state) return;
    this.sql.exec('INSERT OR REPLACE INTO room (key, value) VALUES (?, ?)', 'meta', JSON.stringify(this.meta));
    this.sql.exec('INSERT OR REPLACE INTO room (key, value) VALUES (?, ?)', 'state', json);
    this.saved = json;
  }
}

function send(ws: WebSocket, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // connexion en cours de fermeture
  }
}
