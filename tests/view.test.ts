import { describe, expect, it } from 'vitest';
import { currentRound } from '../src/shared/engine';
import { viewFor } from '../src/shared/view';
import { act, expectOk, layer, playRound, started, submitAll } from './helpers';

const json = (v: unknown) => JSON.stringify(v);

describe('Ce que chaque joueur voit', () => {
  it('création : personne ne voit le meme des autres, seulement qu’ils ont validé', () => {
    const s = started(3);
    expectOk(act(s, 'm1', { type: 'submit', layers: [layer('SECRET DE M1')] }));
    const v = viewFor(s, 'm0', s.phaseStartedAt);
    expect(json(v)).not.toContain('SECRET DE M1');
    expect(json(v)).not.toContain(currentRound(s).assignments.m1!.photoId);
    expect(v.players.find((p) => p.id === 'm1')?.done).toBe(true);
    expect(v.players.find((p) => p.id === 'm2')?.done).toBe(false);
    expect(viewFor(s, 'm1', s.phaseStartedAt).creation?.draft?.[0]?.text).toBe('SECRET DE M1');
  });

  it('vote : seul le meme affiché est envoyé, sans auteur ni notes des autres', () => {
    const s = started(4);
    submitAll(s);
    const round = currentRound(s);
    const [author, next] = round.voteOrder as [string, string];
    const voter = ['m0', 'm1', 'm2', 'm3'].find((id) => id !== author)!;
    const other = ['m0', 'm1', 'm2', 'm3'].find((id) => id !== author && id !== voter)!;
    expectOk(act(s, other, { type: 'vote', authorId: author, note: 17 }));

    const v = viewFor(s, voter, s.phaseStartedAt);
    expect(v.vote?.isMine).toBe(false);
    expect(Object.keys(v.vote!)).not.toContain('authorId');
    expect(json(v)).not.toContain(`meme de ${next}`); // le meme suivant reste caché
    expect(v.vote?.myNote).toBeNull();
    expect(json(v.vote)).not.toContain('17');
    expect(viewFor(s, author, s.phaseStartedAt).vote?.isMine).toBe(true);
  });

  it('résultats : auteurs et notes révélés, aucun total cumulé', () => {
    const s = started(3);
    playRound(s, () => 14);
    const v = viewFor(s, 'm0', s.phaseStartedAt);
    expect(v.results?.memes).toHaveLength(3);
    expect(v.results?.memes[0]?.votes).toBeDefined();
    expect(v.final).toBeNull();
  });

  it('Fauto : le détenteur voit son gadget, les autres seulement le nombre en circulation', () => {
    const s = started(3);
    playRound(s, () => 10);
    const holder = Object.keys(s.gadgets.fauto.holders)[0]!;
    const other = s.players.find((p) => p.id !== holder)!.id;
    expect(viewFor(s, holder, s.phaseStartedAt).fauto.mine).not.toBeNull();
    const ov = viewFor(s, other, s.phaseStartedAt);
    expect(ov.fauto.mine).toBeNull();
    expect(ov.fauto.inCirculation).toBe(1);
  });
});
