import { describe, expect, it } from 'vitest';
import {
  fromBase64Url,
  hashPassword,
  PBKDF2_ITERATIONS,
  randomRoomCode,
  randomToken,
  sha256Hex,
  timingSafeEqualText,
  toBase64Url,
  verifyPassword,
} from '../src/server/lib/crypto';
import { sniffImageType } from '../src/server/lib/images';
import { IP_POLICY, isExpired, MEMBER_POLICY, recordFailure, retryAfterMs } from '../src/server/lib/rate-limit';

describe('mots de passe', () => {
  it('un mot de passe haché se vérifie, un autre est refusé', async () => {
    const stored = await hashPassword('fromage22', 1000);
    expect(await verifyPassword('fromage22', stored)).toBe(true);
    expect(await verifyPassword('fromage23', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('le mot de passe n’est jamais stocké en clair et le sel change à chaque fois', async () => {
    const a = await hashPassword('fromage22', 1000);
    const b = await hashPassword('fromage22', 1000);
    expect(a).not.toContain('fromage22');
    expect(a).not.toBe(b);
    expect(a.startsWith('pbkdf2-sha256$1000$')).toBe(true);
  });

  it('par défaut : PBKDF2 à 100 000 itérations (maximum accepté par les Workers)', async () => {
    expect(PBKDF2_ITERATIONS).toBe(100_000);
    const stored = await hashPassword('fromage22');
    expect(stored.split('$')[1]).toBe('100000');
    expect(await verifyPassword('fromage22', stored)).toBe(true);
  });

  it('un haché mal formé ne valide rien', async () => {
    expect(await verifyPassword('x', 'n’importe quoi')).toBe(false);
    expect(await verifyPassword('x', 'pbkdf2-sha256$0$AA$AA')).toBe(false);
    expect(await verifyPassword('x', 'md5$1000$AA$AA')).toBe(false);
  });
});

describe('jetons et codes', () => {
  it('base64url aller-retour', () => {
    const bytes = Uint8Array.from([0, 255, 62, 63, 128, 7]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
  });

  it('jetons aléatoires distincts, de la bonne longueur', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
    expect(randomToken().length).toBe(43); // 32 octets
    expect(randomToken(16).length).toBe(22);
  });

  it('codes de partie : 5 lettres majuscules', () => {
    for (let i = 0; i < 500; i++) expect(randomRoomCode()).toMatch(/^[A-Z]{5}$/);
  });

  it('les 26 lettres sortent dans les codes', () => {
    const letters = new Set(Array.from({ length: 400 }, () => randomRoomCode()).join(''));
    expect(letters.size).toBe(26);
  });

  it('SHA-256 connu', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('comparaison en temps constant', () => {
    expect(timingSafeEqualText('secret', 'secret')).toBe(true);
    expect(timingSafeEqualText('secret', 'secreT')).toBe(false);
    expect(timingSafeEqualText('secret', 'secret!')).toBe(false);
  });
});

describe('limitation des tentatives de connexion', () => {
  const T = 1_000_000;

  it('5 erreurs sur un membre → bloqué 15 min', () => {
    let rec = null;
    for (let i = 0; i < 4; i++) {
      rec = recordFailure(rec, T + i, MEMBER_POLICY);
      expect(retryAfterMs(rec, T + i)).toBe(0);
    }
    rec = recordFailure(rec, T + 10, MEMBER_POLICY);
    expect(retryAfterMs(rec, T + 10)).toBe(MEMBER_POLICY.lockMs);
    expect(retryAfterMs(rec, T + 10 + MEMBER_POLICY.lockMs)).toBe(0);
  });

  it('les erreurs anciennes sortent de la fenêtre', () => {
    let rec = null;
    for (let i = 0; i < 4; i++) rec = recordFailure(rec, T, MEMBER_POLICY);
    rec = recordFailure(rec, T + MEMBER_POLICY.windowMs, MEMBER_POLICY);
    expect(rec.failures).toBe(1);
    expect(retryAfterMs(rec, T + MEMBER_POLICY.windowMs)).toBe(0);
  });

  it('après un blocage, le compteur repart de zéro', () => {
    let rec = null;
    for (let i = 0; i < 5; i++) rec = recordFailure(rec, T, MEMBER_POLICY);
    const after = T + MEMBER_POLICY.lockMs;
    rec = recordFailure(rec, after, MEMBER_POLICY);
    expect(rec.failures).toBe(1);
    expect(rec.lockedUntil).toBeNull();
  });

  it('par adresse IP, le seuil est plus haut (20)', () => {
    let rec = null;
    for (let i = 0; i < 19; i++) rec = recordFailure(rec, T, IP_POLICY);
    expect(retryAfterMs(rec, T)).toBe(0);
    rec = recordFailure(rec, T, IP_POLICY);
    expect(retryAfterMs(rec, T)).toBe(IP_POLICY.lockMs);
  });

  it('une clé terminée peut être oubliée', () => {
    const rec = recordFailure(null, T, MEMBER_POLICY);
    expect(isExpired(rec, T + 1, MEMBER_POLICY)).toBe(false);
    expect(isExpired(rec, T + MEMBER_POLICY.windowMs, MEMBER_POLICY)).toBe(true);
  });
});

describe('format des images envoyées', () => {
  it('reconnaît WebP et JPEG à leurs premiers octets', () => {
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ');
    expect(sniffImageType(webp)).toBe('image/webp');
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
  });

  it('refuse tout le reste (PNG, HTML, vide)', () => {
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<html><script>'))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
