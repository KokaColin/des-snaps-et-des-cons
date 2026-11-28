import { describe, expect, it } from 'vitest';
import { currentRound, setConnection, setLibrary, tick } from '../src/shared/engine';
import { drawPhotos } from '../src/shared/photos';
import { act, expectOk, ids, layer, library, lobby, nextRound, playRound, started, submitAll, voteAll } from './helpers';

describe('Attribution des photos', () => {
  it('une photo différente par joueur dans la manche', () => {
    const s = started(7);
    const photos = Object.values(currentRound(s).assignments).map((a) => a.photoId);
    expect(new Set(photos).size).toBe(7);
  });

  it('aucune photo ne revient dans la partie quand la photothèque est grande', () => {
    const s = started(7);
    const seen: string[] = [];
    for (let r = 1; r <= 3; r++) {
      seen.push(...Object.values(currentRound(s).assignments).map((a) => a.photoId));
      playRound(s, () => 10);
      nextRound(s);
    }
    expect(new Set(seen).size).toBe(21);
  });

  it('les photos jamais ou le moins récemment jouées passent en priorité', () => {
    // 100 photos : les 10 premières jamais jouées, les autres jouées récemment.
    const pool = library(100, 0, (i) => (i < 10 ? null : 5_000_000 + i)).iconic;
    const rng = { seed: 3 };
    const picked = drawPhotos(rng, pool, 3, new Set());
    for (const id of picked) expect(Number(id.slice(1))).toBeLessThan(40);
  });

  it('petite photothèque (2 par joueur) : la partie se joue quand même, sans doublon dans une manche', () => {
    const s = lobby(3);
    setLibrary(s, library(6));
    expectOk(act(s, 'm0', { type: 'start' }));
    for (let r = 1; r <= 3; r++) {
      const photos = Object.values(currentRound(s).assignments).map((a) => a.photoId);
      expect(new Set(photos).size).toBe(3);
      playRound(s, () => 10);
      nextRound(s);
    }
    expect(s.phase).toBe('final');
  });
});

describe('Création du meme', () => {
  it('brouillon modifiable, puis validation définitive', () => {
    const s = started(3);
    expectOk(act(s, 'm0', { type: 'draft', layers: [layer('v1')] }));
    expectOk(act(s, 'm0', { type: 'submit', layers: [layer('v2')] }));
    expect(act(s, 'm0', { type: 'draft', layers: [layer('v3')] })).toEqual({ ok: false, error: 'already_submitted' });
    expect(currentRound(s).drafts.m0?.[0]?.text).toBe('v2');
  });

  it('refuse plus de 3 zones de texte ou un format invalide, tronque un texte trop long', () => {
    const s = started(3);
    expect(act(s, 'm0', { type: 'draft', layers: [layer('a'), layer('b'), layer('c'), layer('d')] }).ok).toBe(false);
    expect(act(s, 'm0', { type: 'draft', layers: [{ ...layer('a'), color: 'chartreuse' }] }).ok).toBe(false);
    expect(act(s, 'm0', { type: 'draft', layers: 'coucou' }).ok).toBe(false);
    expectOk(act(s, 'm0', { type: 'draft', layers: [{ ...layer('x'.repeat(500)), x: 7 }] }));
    const saved = currentRound(s).drafts.m0![0]!;
    expect(saved.text).toHaveLength(120);
    expect(saved.x).toBe(1);
  });

  it('un seul changement d’image par manche', () => {
    const s = started(3);
    const before = currentRound(s).assignments.m0!.photoId;
    expectOk(act(s, 'm0', { type: 'reroll' }));
    const after = currentRound(s).assignments.m0!.photoId;
    expect(after).not.toBe(before);
    const others = ['m1', 'm2'].map((id) => currentRound(s).assignments[id]!.photoId);
    expect(others).not.toContain(after);
    expect(act(s, 'm0', { type: 'reroll' })).toEqual({ ok: false, error: 'reroll_used' });
  });

  it('la manche passe au vote dès que tout le monde a validé', () => {
    const s = started(3);
    submitAll(s);
    expect(s.phase).toBe('vote');
  });

  it('à la fin du chrono, les memes non validés partent tels quels (image seule si vide)', () => {
    const s = started(3);
    expectOk(act(s, 'm0', { type: 'submit', layers: [layer('fini')] }));
    expectOk(act(s, 'm1', { type: 'draft', layers: [layer('en cours')] }));
    tick(s, s.deadline! - 1);
    expect(s.phase).toBe('creation');
    tick(s, s.deadline!);
    expect(s.phase).toBe('vote');
    const memes = currentRound(s).memes;
    expect(memes.m0?.layers[0]?.text).toBe('fini');
    expect(memes.m1?.layers[0]?.text).toBe('en cours');
    expect(memes.m2?.layers).toEqual([]);
  });

  it('un joueur absent depuis plus de 15 s ne bloque plus la fin anticipée', () => {
    const s = started(3);
    const t = s.phaseStartedAt;
    setConnection(s, 'm2', false, t);
    expectOk(act(s, 'm0', { type: 'submit', layers: [] }, t + 1000));
    expectOk(act(s, 'm1', { type: 'submit', layers: [] }, t + 1000));
    expect(s.phase).toBe('creation'); // m2 peut encore revenir
    tick(s, t + 14_999);
    expect(s.phase).toBe('creation');
    tick(s, t + 15_000);
    expect(s.phase).toBe('vote');
    expect(currentRound(s).memes.m2?.layers).toEqual([]);
  });
});

describe('Vote', () => {
  it('les memes défilent un par un, dans un ordre mélangé', () => {
    const s = started(5);
    submitAll(s);
    const order = currentRound(s).voteOrder;
    expect([...order].sort()).toEqual(ids(s).sort());
  });

  it('impossible de voter pour son propre meme', () => {
    const s = started(3);
    submitAll(s);
    const author = currentRound(s).voteOrder[0]!;
    expect(act(s, author, { type: 'vote', index: 0, note: 22 })).toEqual({ ok: false, error: 'own_meme' });
  });

  it('une seule note par meme et par votant, non modifiable', () => {
    const s = started(4);
    submitAll(s);
    const author = currentRound(s).voteOrder[0]!;
    const voter = ids(s).find((id) => id !== author)!;
    expectOk(act(s, voter, { type: 'vote', index: 0, note: 12 }));
    expect(act(s, voter, { type: 'vote', index: 0, note: 22 })).toEqual({ ok: false, error: 'already_voted' });
    expect(currentRound(s).votes[author]?.[voter]).toBe(12);
  });

  it('note entière de 0 à 22 uniquement', () => {
    const s = started(3);
    submitAll(s);
    const author = currentRound(s).voteOrder[0]!;
    const voter = ids(s).find((id) => id !== author)!;
    for (const note of [-1, 23, 10.5, Number.NaN]) {
      expect(act(s, voter, { type: 'vote', index: 0, note })).toEqual({ ok: false, error: 'invalid_note' });
    }
    expectOk(act(s, voter, { type: 'vote', index: 0, note: 0 }));
  });

  it('impossible de noter un autre meme que celui affiché', () => {
    const s = started(3);
    submitAll(s);
    const [, second] = currentRound(s).voteOrder;
    const voter = ids(s).find((id) => id !== second)!;
    expect(act(s, voter, { type: 'vote', index: 1, note: 5 })).toEqual({ ok: false, error: 'not_current_meme' });
  });

  it('passe au meme suivant dès que tous les votants connectés ont noté', () => {
    const s = started(3);
    submitAll(s);
    const round = currentRound(s);
    const author = round.voteOrder[0]!;
    for (const v of ids(s).filter((id) => id !== author)) act(s, v, { type: 'vote', index: 0, note: 5 });
    expect(round.voteCursor).toBe(1);
  });

  it('un votant absent ne bloque pas et son vote est neutralisé', () => {
    const s = started(4);
    submitAll(s);
    setConnection(s, 'm3', false, s.phaseStartedAt);
    voteAll(s, (voter) => (voter === 'm3' ? null : 20));
    expect(s.phase).toBe('results');
    for (const meme of currentRound(s).results!.memes) {
      expect(meme.score).toEqual({ n: 20, d: 1 });
    }
  });

  it('chrono écoulé sans vote : meme suivant', () => {
    const s = started(3);
    submitAll(s);
    tick(s, s.deadline!);
    expect(currentRound(s).voteCursor).toBe(1);
  });
});
