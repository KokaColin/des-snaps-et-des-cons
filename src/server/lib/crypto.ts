/**
 * Outils cryptographiques (WebCrypto standard : disponible dans les Workers et dans Node).
 *
 * Mots de passe : PBKDF2-SHA256, sel aléatoire de 16 octets, 100 000 itérations (le maximum
 * accepté par les Workers). Le calcul se fait dans le Durable Object `Group`, pas dans le
 * Worker, à cause de la limite de CPU courte des Workers gratuits.
 */
export const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Jeton aléatoire imprévisible (32 octets par défaut), en base64url. */
export function randomToken(bytes = 32): string {
  return toBase64Url(randomBytes(bytes));
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? encoder.encode(data) : data;
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', input as BufferSource)));
}

/** Comparaison en temps constant (évite de révéler la longueur du préfixe commun). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

export function timingSafeEqualText(a: string, b: string): boolean {
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** Hache un mot de passe. Format stocké : `pbkdf2-sha256$<itérations>$<sel>$<hachage>`. */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$');
  const iterations = Number(iter);
  if (scheme !== 'pbkdf2-sha256' || !salt || !hash || !Number.isInteger(iterations) || iterations < 1) {
    return false;
  }
  const expected = fromBase64Url(hash);
  const actual = await pbkdf2(password, fromBase64Url(salt), iterations);
  return timingSafeEqual(actual, expected);
}

/** Code de partie : 5 lettres majuscules tirées uniformément. */
export function randomRoomCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  // 256 n'est pas un multiple de 26 : on rejette les octets ≥ 234 pour rester uniforme.
  while (code.length < 5) {
    for (const b of randomBytes(8)) {
      if (b < 234 && code.length < 5) code += letters[b % 26];
    }
  }
  return code;
}
