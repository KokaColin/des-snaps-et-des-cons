/**
 * Fractions exactes : un score est une moyenne de notes entières, donc une fraction.
 * Calculer en fractions évite toute erreur d'arrondi dans les totaux et les égalités.
 */
export interface Fraction {
  readonly n: number;
  readonly d: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function frac(n: number, d = 1): Fraction {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    throw new Error(`Fraction invalide : ${n}/${d}`);
  }
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export const ZERO = frac(0);

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.n * b.d + b.n * a.d, a.d * b.d);
}

/** Négatif si a < b, 0 si égaux, positif si a > b. */
export function compare(a: Fraction, b: Fraction): number {
  return a.n * b.d - b.n * a.d;
}

export function equals(a: Fraction, b: Fraction): boolean {
  return compare(a, b) === 0;
}

export function toNumber(f: Fraction): number {
  return f.n / f.d;
}

/** Affichage à une décimale, à la française (« 17,5 »). */
export function format(f: Fraction): string {
  return (Math.round(toNumber(f) * 10) / 10).toFixed(1).replace('.', ',');
}
