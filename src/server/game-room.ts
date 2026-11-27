import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';

/**
 * Une partie = un Durable Object. Il héberge le moteur de jeu (src/shared/engine.ts),
 * les connexions WebSocket des joueurs et les chronos (alarmes).
 *
 * Lot 1 : squelette. Le branchement du moteur et du temps réel arrive à l'étape 5.
 */
export class GameRoom extends DurableObject<Env> {
  override async fetch(_request: Request): Promise<Response> {
    return new Response('Salon temps réel : bientôt disponible', { status: 501 });
  }
}
