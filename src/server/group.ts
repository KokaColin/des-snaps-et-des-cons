import { DurableObject } from 'cloudflare:workers';
import type { Env } from './index';

/**
 * Objet unique du Groupe des 7 : comptes, photothèque (fichiers + infos),
 * memes, statistiques et galerie légendaire, dans sa base SQLite.
 *
 * Lot 1 : squelette. Comptes à l'étape 3, photothèque à l'étape 4.
 */
export class Group extends DurableObject<Env> {
  override async fetch(_request: Request): Promise<Response> {
    return new Response('Groupe : bientôt disponible', { status: 501 });
  }
}
