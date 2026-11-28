/**
 * Point d'entrée du Worker.
 *
 * - Les fichiers de l'application (dist/client) sont servis directement par Cloudflare.
 * - /api/rooms : création d'une partie (membres) et informations sur un code.
 * - /api/* (le reste) : comptes et photothèque, transmis à l'objet `Group`.
 * - /ws/:code : connexion temps réel à une partie, routée vers son Durable Object.
 */
import { groupStub, roomStub, type Env } from './env';
import { randomRoomCode } from './lib/crypto';
import { error, isSameOrigin, json, readCookie, SESSION_COOKIE } from './lib/http';

export { GameRoom } from './game-room';
export { Group } from './group';
export type { Env } from './env';

const ROOM_CODE = /^[A-Z]{5}$/;
const ROOM_INFO = /^\/api\/rooms\/([A-Za-z]{5})$/;
/** En-têtes posés par le Worker uniquement : on écrase toute valeur venue de l'extérieur. */
const TRUSTED_HEADERS = ['X-Member', 'X-Client-IP'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health') {
      return json({ ok: true, game: 'Des Snaps et des Cons', version: '0.2.0' });
    }

    if (path.startsWith('/ws/')) {
      const code = path.slice(4).toUpperCase();
      if (!ROOM_CODE.test(code)) return new Response('Code de partie invalide', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
      if (!isSameOrigin(request) && request.headers.get('Origin')) return new Response('Origine refusée', { status: 403 });
      const member = await groupStub(env).sessionMember(readCookie(request, SESSION_COOKIE));
      const headers = trustedHeaders(request);
      if (member) headers.set('X-Member', member);
      return roomStub(env, code).fetch(new Request(request, { headers }));
    }

    if (path === '/api/rooms' && request.method === 'POST') {
      if (!isSameOrigin(request)) return error('bad_origin', 403);
      const member = await groupStub(env).sessionMember(readCookie(request, SESSION_COOKIE));
      if (!member) return error('members_only', 401);
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomRoomCode();
        if (await roomStub(env, code).init(code, member)) return json({ code }, 201);
      }
      return error('no_free_code', 503);
    }

    const info = ROOM_INFO.exec(path);
    if (info && request.method === 'GET') {
      const code = (info[1] as string).toUpperCase();
      return json(await roomStub(env, code).info());
    }

    if (path.startsWith('/api/')) {
      const headers = trustedHeaders(request);
      headers.set('X-Client-IP', request.headers.get('CF-Connecting-IP') ?? 'inconnue');
      // Corps lu en entier avant transmission : l'objet peut répondre sans le lire (refus),
      // ce qui laisserait sinon un flux orphelin. Les envois sont bornés (photos < 2 Mo).
      const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer();
      return groupStub(env).fetch(new Request(request.url, { method: request.method, headers, body }));
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function trustedHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  for (const name of TRUSTED_HEADERS) headers.delete(name);
  return headers;
}
