/**
 * Limitation des tentatives de connexion (logique pure, stockage géré par l'appelant).
 *
 * Chaque clé (un membre, ou une adresse IP) accumule ses échecs dans une fenêtre glissante ;
 * au-delà du seuil, la clé est bloquée pendant `lockMs`. Une connexion réussie efface la clé
 * du membre.
 */
export interface AttemptRecord {
  failures: number;
  windowStart: number;
  lockedUntil: number | null;
}

export interface RatePolicy {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

/** Par membre : 5 erreurs en 15 min → 15 min de blocage. */
export const MEMBER_POLICY: RatePolicy = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
/** Par adresse IP : 20 erreurs en 15 min → 30 min de blocage (protège tous les comptes à la fois). */
export const IP_POLICY: RatePolicy = { maxFailures: 20, windowMs: 15 * 60_000, lockMs: 30 * 60_000 };

/** Temps d'attente restant avant une nouvelle tentative (0 = autorisé). */
export function retryAfterMs(record: AttemptRecord | null, now: number): number {
  if (!record || record.lockedUntil === null) return 0;
  return Math.max(0, record.lockedUntil - now);
}

/** Enregistre un échec et renvoie le nouvel état de la clé. */
export function recordFailure(record: AttemptRecord | null, now: number, policy: RatePolicy): AttemptRecord {
  const lockOver = record !== null && record.lockedUntil !== null && record.lockedUntil <= now;
  const windowOver = record !== null && record.lockedUntil === null && now - record.windowStart >= policy.windowMs;
  const fresh = record === null || lockOver || windowOver;
  const base: AttemptRecord = fresh ? { failures: 0, windowStart: now, lockedUntil: null } : { ...(record as AttemptRecord) };
  base.failures += 1;
  if (base.failures >= policy.maxFailures) base.lockedUntil = now + policy.lockMs;
  return base;
}

/** Une clé peut être oubliée quand sa fenêtre et son éventuel blocage sont terminés. */
export function isExpired(record: AttemptRecord, now: number, policy: RatePolicy): boolean {
  return now - record.windowStart >= policy.windowMs && retryAfterMs(record, now) === 0;
}
