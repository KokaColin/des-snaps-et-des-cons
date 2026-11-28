import { describe, expect, it } from 'vitest';
import { heartbeat, isAbsent, setConnection } from '../src/shared/engine';
import { viewFor } from '../src/shared/view';
import { lobby, started, T0 } from './helpers';

describe('Présence : signes de vie (pings du téléphone)', () => {
  it('« absent » après 5 s sans signe de vie, présent dès le ping suivant', () => {
    const s = lobby(3);
    const p = s.players[1]!;
    expect(isAbsent(s, p, T0 + 5_000)).toBe(false);
    expect(isAbsent(s, p, T0 + 5_001)).toBe(true);
    expect(heartbeat(s, p.id, T0 + 5_500)).toEqual({ ok: true });
    expect(isAbsent(s, p, T0 + 6_000)).toBe(false);
    expect(viewFor(s, 'm0', T0 + 6_000).players[1]!.absent).toBe(false);
  });

  it('un ping ancien ne fait jamais reculer le dernier signe de vie', () => {
    const s = lobby(3);
    heartbeat(s, 'm1', T0 + 10_000);
    heartbeat(s, 'm1', T0 + 2_000);
    expect(s.players[1]!.lastSeenAt).toBe(T0 + 10_000);
  });

  it('un joueur déconnecté reste absent même avec un signe de vie récent', () => {
    const s = lobby(3);
    setConnection(s, 'm1', false, T0 + 1_000);
    heartbeat(s, 'm1', T0 + 2_000);
    expect(isAbsent(s, s.players[1]!, T0 + 2_000)).toBe(true);
  });

  it('joueur inconnu refusé', () => {
    expect(heartbeat(lobby(3), 'personne', T0)).toEqual({ ok: false, error: 'unknown_player' });
  });

  it('la vue donne le début de la phase (anneau du chrono) et l’échéance', () => {
    const s = started(3);
    const v = viewFor(s, 'm0', T0 + 1_000);
    expect(v.phaseStartedAt).toBe(T0);
    expect(v.deadline).toBe(T0 + s.config.creationMs);
    expect(v.serverNow).toBe(T0 + 1_000);
  });
});
