/**
 * Point d'entrée du Worker.
 *
 * - Les fichiers de l'application (dist/client) sont servis directement par Cloudflare.
 * - /api/* : API HTTP (comptes, photothèque…) — branchée au lot 2.
 * - /ws/:code : connexion temps réel à une partie, routée vers son Durable Object.
 */
export { GameRoom } from './game-room';
export { Group } from './group';

export interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
  GROUP: DurableObjectNamespace;
}

const ROOM_CODE = /^[A-Z]{5}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, game: 'Des Snaps et des Cons', version: '0.1.0' });
    }

    if (url.pathname.startsWith('/ws/')) {
      const code = url.pathname.slice(4).toUpperCase();
      if (!ROOM_CODE.test(code)) return new Response('Code de partie invalide', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('WebSocket attendu', { status: 426 });
      }
      const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
      return room.fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
