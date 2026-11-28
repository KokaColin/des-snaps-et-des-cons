import { isMemberName, type MemberName } from '../../shared/config';

/** Couleur de pastille de chaque membre ; les invités ont une pastille crème à bord pointillé. */
export const MEMBER_COLORS: Record<MemberName, string> = {
  Trystan: '#ff8f5a',
  Raffael: '#3ec6e0',
  Maxe: '#ffc23d',
  Gasdard: '#6fdc7a',
  Gaslard: '#a678ff',
  Caulin: '#ff7aa8',
  Tibaud: '#8fb6ff',
};

export function colorFor(name: string): string | null {
  return isMemberName(name) ? MEMBER_COLORS[name] : null;
}

export function initial(name: string): string {
  return [...name.trim()][0]?.toLocaleUpperCase('fr') ?? '?';
}
