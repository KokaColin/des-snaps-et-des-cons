import type { GameRoom } from './game-room';
import type { Group } from './group';

export interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
  GROUP: DurableObjectNamespace<Group>;
  /** Secret du mainteneur (`wrangler secret put ADMIN_TOKEN`) : réinitialisation des mots de passe. */
  ADMIN_TOKEN?: string;
}

/** L'unique objet du Groupe des 7. */
export function groupStub(env: Env): DurableObjectStub<Group> {
  return env.GROUP.get(env.GROUP.idFromName('groupe-des-7'));
}

export function roomStub(env: Env, code: string): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
}
