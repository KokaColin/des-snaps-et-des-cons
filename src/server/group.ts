import { DurableObject } from 'cloudflare:workers';
import { isMemberName, MEMBER_NAMES, type MemberName } from '../shared/config';
import {
  MAX_PHOTO_BYTES,
  MAX_THUMB_BYTES,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PHOTO_MAX_SIDE,
  TRASH_DAYS,
  type MeResponse,
  type PhotoInfo,
  type PhotosResponse,
} from '../shared/protocol';
import type { LibrarySnapshot, PhotoCategory } from '../shared/types';
import type { Env } from './env';
import { hashPassword, randomToken, sha256Hex, timingSafeEqualText, verifyPassword } from './lib/crypto';
import {
  clearSessionCookie,
  error,
  isSameOrigin,
  json,
  readCookie,
  readJson,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  sessionCookie,
} from './lib/http';
import { sniffImageType } from './lib/images';
import {
  IP_POLICY,
  isExpired,
  MEMBER_POLICY,
  recordFailure,
  retryAfterMs,
  type AttemptRecord,
  type RatePolicy,
} from './lib/rate-limit';

const DAY_MS = 24 * 3600_000;
const TRASH_MS = TRASH_DAYS * DAY_MS;
const CATEGORIES: readonly PhotoCategory[] = ['iconic', 'fauto'];
const PHOTO_ROUTE = /^\/api\/photos\/([A-Za-z0-9_-]{16,32})(?:\/(full|thumb|restore))?$/;

type Row = Record<string, SqlStorageValue>;

/**
 * Objet unique du Groupe des 7, dans sa base SQLite :
 * - comptes des 7 membres (mots de passe hachés), sessions longues, limitation des tentatives ;
 * - photothèque : fichiers (photo 1600 px + miniature 400 px) et informations, corbeille 30 jours.
 *
 * Le Worker lui transmet les requêtes `/api/*` (sauf parties) ; les salons l'appellent en RPC
 * (`sessionMember`, `library`, `markPlayed`).
 */
export class Group extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        member TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        member TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        key TEXT PRIMARY KEY,
        failures INTEGER NOT NULL,
        window_start INTEGER NOT NULL,
        locked_until INTEGER
      );
      CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        source_hash TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mime TEXT NOT NULL,
        thumb_mime TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        size INTEGER NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER,
        deleted_at INTEGER,
        deleted_by TEXT,
        legendary INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS photos_source_hash ON photos (source_hash);
      CREATE INDEX IF NOT EXISTS photos_content_hash ON photos (content_hash);
      CREATE TABLE IF NOT EXISTS photo_files (
        photo_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        data BLOB NOT NULL,
        PRIMARY KEY (photo_id, kind)
      );
    `);
  }

  // -------------------------------------------------------------------------------------------
  // RPC (appelé par le Worker et les salons)
  // -------------------------------------------------------------------------------------------

  /** Membre correspondant à un jeton de session, ou null. */
  async sessionMember(token: string | null): Promise<MemberName | null> {
    if (!token) return null;
    const row = this.sql
      .exec('SELECT member FROM sessions WHERE token_hash = ? AND expires_at > ?', await sha256Hex(token), Date.now())
      .toArray()[0];
    const member = row?.member;
    return isMemberName(member) ? member : null;
  }

  /** Photothèque active (hors corbeille), telle que le moteur la consomme. */
  async library(): Promise<LibrarySnapshot> {
    const snapshot: LibrarySnapshot = { iconic: [], fauto: [] };
    for (const row of this.sql.exec('SELECT id, category, last_played_at FROM photos WHERE deleted_at IS NULL')) {
      const ref = { id: String(row.id), lastPlayedAt: row.last_played_at === null ? null : Number(row.last_played_at) };
      (row.category === 'fauto' ? snapshot.fauto : snapshot.iconic).push(ref);
    }
    return snapshot;
  }

  /** Photos distribuées en partie : compteur d'utilisations et date de dernière utilisation. */
  async markPlayed(photoIds: string[], at: number): Promise<void> {
    for (const id of new Set(photoIds)) {
      this.sql.exec('UPDATE photos SET uses = uses + 1, last_played_at = ? WHERE id = ?', at, id);
    }
  }

  // -------------------------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------------------------

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method !== 'GET' && method !== 'HEAD' && !isSameOrigin(request)) return error('bad_origin', 403);

    try {
      if (path === '/api/me' && method === 'GET') return await this.me(request);
      if (path === '/api/login' && method === 'POST') return await this.login(request);
      if (path === '/api/logout' && method === 'POST') return await this.logout(request);
      if (path === '/api/admin/reset' && method === 'POST') return await this.adminReset(request);
      if (path === '/api/photos' && method === 'GET') return await this.listPhotos(request);
      if (path === '/api/photos' && method === 'POST') return await this.uploadPhoto(request);

      const match = PHOTO_ROUTE.exec(path);
      if (match) {
        const [, id, sub] = match as unknown as [string, string, string | undefined];
        if ((sub === 'full' || sub === 'thumb') && method === 'GET') return this.servePhoto(id, sub);
        if (sub === 'restore' && method === 'POST') return await this.restorePhoto(request, id);
        if (!sub && method === 'PATCH') return await this.updatePhoto(request, id);
        if (!sub && method === 'DELETE') return await this.trashPhoto(request, id);
      }
      return error('not_found', 404);
    } catch (e) {
      console.error('Group', path, e);
      return error('server_error', 500);
    }
  }

  private async currentMember(request: Request): Promise<MemberName | null> {
    return this.sessionMember(readCookie(request, SESSION_COOKIE));
  }

  // --- Comptes --------------------------------------------------------------------------------

  private async me(request: Request): Promise<Response> {
    const withPassword = new Set(this.sql.exec('SELECT member FROM accounts').toArray().map((r) => r.member));
    const body: MeResponse = {
      member: await this.currentMember(request),
      accounts: MEMBER_NAMES.map((name) => ({ name, hasPassword: withPassword.has(name) })),
    };
    return json(body);
  }

  private async login(request: Request): Promise<Response> {
    const body = await readJson(request);
    const member = body?.member;
    const password = body?.password;
    if (!isMemberName(member)) return error('unknown_member', 400);
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return error('invalid_password', 400);
    }

    const now = Date.now();
    const ip = request.headers.get('X-Client-IP') ?? 'inconnue';
    const memberKey = `m:${member}`;
    const ipKey = `ip:${ip}`;
    const wait = Math.max(retryAfterMs(this.attempt(memberKey), now), retryAfterMs(this.attempt(ipKey), now));
    if (wait > 0) return error('too_many_attempts', 429, { retryAfterS: Math.ceil(wait / 1000) });

    const storedHash = (): string | null => {
      const row = this.sql.exec('SELECT password FROM accounts WHERE member = ?', member).toArray()[0];
      return row ? String(row.password) : null;
    };
    let toVerify = storedHash();
    if (toVerify === null) {
      // Première connexion : le mot de passe choisi devient celui du compte.
      if (body?.create !== true) return error('account_not_created', 409);
      const hash = await hashPassword(password);
      const inserted = this.sql.exec(
        'INSERT OR IGNORE INTO accounts (member, password, created_at) VALUES (?, ?, ?)',
        member,
        hash,
        now,
      ).rowsWritten;
      // Si quelqu'un a créé le compte entre-temps, on retombe sur une vérification normale.
      toVerify = inserted === 0 ? storedHash() : null;
    }
    if (toVerify !== null && !(await verifyPassword(password, toVerify))) {
      this.fail(memberKey, now, MEMBER_POLICY);
      this.fail(ipKey, now, IP_POLICY);
      return error('wrong_password', 401);
    }

    this.sql.exec('DELETE FROM attempts WHERE key = ?', memberKey);
    this.sql.exec('DELETE FROM sessions WHERE expires_at <= ?', now);
    const token = randomToken();
    this.sql.exec(
      'INSERT INTO sessions (token_hash, member, created_at, expires_at) VALUES (?, ?, ?, ?)',
      await sha256Hex(token),
      member,
      now,
      now + SESSION_MAX_AGE_S * 1000,
    );
    const secure = new URL(request.url).protocol === 'https:';
    return json({ member }, 200, { 'Set-Cookie': sessionCookie(token, secure) });
  }

  private async logout(request: Request): Promise<Response> {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', await sha256Hex(token));
    const secure = new URL(request.url).protocol === 'https:';
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(secure) });
  }

  /** Réinitialisation d'un compte par le mainteneur (secret ADMIN_TOKEN). */
  private async adminReset(request: Request): Promise<Response> {
    const secret = this.env.ADMIN_TOKEN;
    const given = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!secret || !given || !timingSafeEqualText(given, secret)) return error('not_found', 404);
    const body = await readJson(request);
    const member = body?.member;
    if (!isMemberName(member)) return error('unknown_member', 400);
    this.sql.exec('DELETE FROM accounts WHERE member = ?', member);
    this.sql.exec('DELETE FROM sessions WHERE member = ?', member);
    this.sql.exec('DELETE FROM attempts WHERE key = ?', `m:${member}`);
    return json({ ok: true, member });
  }

  private attempt(key: string): AttemptRecord | null {
    const row = this.sql.exec('SELECT failures, window_start, locked_until FROM attempts WHERE key = ?', key).toArray()[0];
    if (!row) return null;
    return {
      failures: Number(row.failures),
      windowStart: Number(row.window_start),
      lockedUntil: row.locked_until === null ? null : Number(row.locked_until),
    };
  }

  private fail(key: string, now: number, policy: RatePolicy): void {
    const next = recordFailure(this.attempt(key), now, policy);
    this.sql.exec(
      'INSERT OR REPLACE INTO attempts (key, failures, window_start, locked_until) VALUES (?, ?, ?, ?)',
      key,
      next.failures,
      next.windowStart,
      next.lockedUntil,
    );
  }

  // --- Photothèque ----------------------------------------------------------------------------

  private async listPhotos(request: Request): Promise<Response> {
    if (!(await this.currentMember(request))) return error('members_only', 401);
    const photos = this.sql
      .exec(
        `SELECT id, category, author, created_at, width, height, size, uses, last_played_at, deleted_at, deleted_by
         FROM photos ORDER BY created_at DESC`,
      )
      .toArray()
      .map(toPhotoInfo);
    const body: PhotosResponse = { photos, trashDays: TRASH_DAYS };
    return json(body);
  }

  private async uploadPhoto(request: Request): Promise<Response> {
    const member = await this.currentMember(request);
    if (!member) return error('members_only', 401);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return error('invalid_upload', 400);
    }
    const category = form.get('category');
    const sourceHash = form.get('sourceHash');
    const width = Number(form.get('width'));
    const height = Number(form.get('height'));
    const full = form.get('full');
    const thumb = form.get('thumb');
    if (typeof category !== 'string' || !CATEGORIES.includes(category as PhotoCategory)) {
      return error('invalid_category', 400);
    }
    if (typeof sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(sourceHash)) return error('invalid_upload', 400);
    if (![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= PHOTO_MAX_SIDE)) {
      return error('invalid_upload', 400);
    }
    if (!(full instanceof File) || !(thumb instanceof File)) return error('invalid_upload', 400);
    if (full.size > MAX_PHOTO_BYTES || thumb.size > MAX_THUMB_BYTES) return error('photo_too_big', 413);

    const fullBytes = new Uint8Array(await full.arrayBuffer());
    const thumbBytes = new Uint8Array(await thumb.arrayBuffer());
    const mime = sniffImageType(fullBytes);
    const thumbMime = sniffImageType(thumbBytes);
    if (!mime || !thumbMime) return error('invalid_image', 415);

    const contentHash = await sha256Hex(fullBytes);
    const duplicate = this.sql
      .exec('SELECT deleted_at FROM photos WHERE source_hash = ? OR content_hash = ? LIMIT 1', sourceHash, contentHash)
      .toArray()[0];
    if (duplicate) return error('duplicate', 409, { inTrash: duplicate.deleted_at !== null });

    const id = randomToken(16);
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        `INSERT INTO photos (id, category, author, created_at, source_hash, content_hash, mime, thumb_mime, width, height, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        category,
        member,
        now,
        sourceHash,
        contentHash,
        mime,
        thumbMime,
        width,
        height,
        fullBytes.byteLength,
      );
      this.sql.exec('INSERT INTO photo_files (photo_id, kind, data) VALUES (?, ?, ?)', id, 'full', fullBytes.buffer);
      this.sql.exec('INSERT INTO photo_files (photo_id, kind, data) VALUES (?, ?, ?)', id, 'thumb', thumbBytes.buffer);
    });
    return json({ photo: this.photoInfo(id) }, 201);
  }

  /**
   * Fichier d'une photo. Les identifiants sont aléatoires (128 bits) et ne sont donnés qu'aux
   * membres (liste) ou aux joueurs d'une partie qui l'utilise : l'URL vaut autorisation, ce qui
   * permet aux invités de voir les photos de leur partie sans accéder à la photothèque.
   */
  private servePhoto(id: string, kind: 'full' | 'thumb'): Response {
    const row = this.sql
      .exec(
        `SELECT f.data AS data, p.mime AS mime, p.thumb_mime AS thumb_mime
         FROM photo_files f JOIN photos p ON p.id = f.photo_id WHERE f.photo_id = ? AND f.kind = ?`,
        id,
        kind,
      )
      .toArray()[0];
    if (!row) return error('not_found', 404);
    return new Response(row.data as ArrayBuffer, {
      headers: {
        'Content-Type': String(kind === 'full' ? row.mime : row.thumb_mime),
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  private async updatePhoto(request: Request, id: string): Promise<Response> {
    if (!(await this.currentMember(request))) return error('members_only', 401);
    const body = await readJson(request);
    const category = body?.category;
    if (typeof category !== 'string' || !CATEGORIES.includes(category as PhotoCategory)) {
      return error('invalid_category', 400);
    }
    const written = this.sql.exec('UPDATE photos SET category = ? WHERE id = ?', category, id).rowsWritten;
    if (written === 0) return error('not_found', 404);
    return json({ photo: this.photoInfo(id) });
  }

  private async trashPhoto(request: Request, id: string): Promise<Response> {
    const member = await this.currentMember(request);
    if (!member) return error('members_only', 401);
    const now = Date.now();
    const written = this.sql.exec(
      'UPDATE photos SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL',
      now,
      member,
      id,
    ).rowsWritten;
    if (written === 0 && !this.photoInfo(id)) return error('not_found', 404);
    await this.schedulePurge();
    return json({ photo: this.photoInfo(id) });
  }

  private async restorePhoto(request: Request, id: string): Promise<Response> {
    if (!(await this.currentMember(request))) return error('members_only', 401);
    this.sql.exec('UPDATE photos SET deleted_at = NULL, deleted_by = NULL WHERE id = ?', id);
    const photo = this.photoInfo(id);
    if (!photo) return error('not_found', 404);
    return json({ photo });
  }

  private photoInfo(id: string): PhotoInfo | null {
    const row = this.sql
      .exec(
        `SELECT id, category, author, created_at, width, height, size, uses, last_played_at, deleted_at, deleted_by
         FROM photos WHERE id = ?`,
        id,
      )
      .toArray()[0];
    return row ? toPhotoInfo(row) : null;
  }

  // --- Ménage (alarme) ------------------------------------------------------------------------

  /** Programme l'alarme sur la prochaine photo à purger de la corbeille. */
  private async schedulePurge(): Promise<void> {
    const row = this.sql
      .exec('SELECT MIN(deleted_at) AS next FROM photos WHERE deleted_at IS NOT NULL AND legendary = 0')
      .toArray()[0];
    const next = row?.next;
    if (next === null || next === undefined) return;
    const at = Number(next) + TRASH_MS;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > at) await this.ctx.storage.setAlarm(at);
  }

  override async alarm(): Promise<void> {
    const now = Date.now();
    // Les photos d'un meme légendaire restent conservées, même dans la corbeille.
    const expired = this.sql
      .exec('SELECT id FROM photos WHERE deleted_at IS NOT NULL AND deleted_at <= ? AND legendary = 0', now - TRASH_MS)
      .toArray()
      .map((r) => String(r.id));
    this.ctx.storage.transactionSync(() => {
      for (const id of expired) {
        this.sql.exec('DELETE FROM photo_files WHERE photo_id = ?', id);
        this.sql.exec('DELETE FROM photos WHERE id = ?', id);
      }
      this.sql.exec('DELETE FROM sessions WHERE expires_at <= ?', now);
    });
    for (const row of this.sql.exec('SELECT key, failures, window_start, locked_until FROM attempts').toArray()) {
      const key = String(row.key);
      const record = this.attempt(key);
      const policy = key.startsWith('ip:') ? IP_POLICY : MEMBER_POLICY;
      if (record && isExpired(record, now, policy)) this.sql.exec('DELETE FROM attempts WHERE key = ?', key);
    }
    await this.schedulePurge();
  }
}

function toPhotoInfo(row: Row): PhotoInfo {
  return {
    id: String(row.id),
    category: row.category === 'fauto' ? 'fauto' : 'iconic',
    author: row.author as MemberName,
    createdAt: Number(row.created_at),
    width: Number(row.width),
    height: Number(row.height),
    size: Number(row.size),
    uses: Number(row.uses),
    lastPlayedAt: row.last_played_at === null ? null : Number(row.last_played_at),
    deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    deletedBy: (row.deleted_by as MemberName | null) ?? null,
  };
}
