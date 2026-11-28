/**
 * Aspect de la grande note du vote, par paliers (cahier des charges, écran Vote) :
 * 0 triste, 1–11 du gris au crème, 12–21 du jaune à l'orange, 22 « LÉGENDAIRE ! ».
 */
const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
const mix = (c1: string, c2: string, t: number) =>
  '#' +
  [1, 3, 5]
    .map((i) => lerp(parseInt(c1.slice(i, i + 2), 16), parseInt(c2.slice(i, i + 2), 16), t).toString(16).padStart(2, '0'))
    .join('');

export interface NoteStyle {
  style: string;
  caption: string;
  captionStyle: string;
  legendary: boolean;
}

export function noteStyle(n: number): NoteStyle {
  if (n <= 0) {
    return {
      style: 'font-size: 96px; color: #5a554b; -webkit-text-stroke: 4px #000; text-shadow: none; transform: skew(-2deg) rotate(6deg) translateY(10px)',
      caption: 'ZÉRO POINTÉ…',
      captionStyle: 'color: #8f8a7f',
      legendary: false,
    };
  }
  if (n <= 11) {
    const t = (n - 1) / 10;
    const s = lerp(1, 4, t);
    return {
      style: `font-size: ${lerp(98, 108, t)}px; color: ${mix('#8f8a7f', '#f3ecdc', t)}; -webkit-text-stroke: 5px #000; text-shadow: ${s}px ${s}px 0 #ff4d8d; transform: skew(-5deg) rotate(${(2 - 2 * t).toFixed(1)}deg)`,
      caption: '',
      captionStyle: '',
      legendary: false,
    };
  }
  if (n <= 21) {
    const t = (n - 12) / 9;
    const s = lerp(4, 7, t);
    return {
      style: `font-size: ${lerp(110, 124, t)}px; color: ${mix('#ffe433', '#ffb02e', t)}; -webkit-text-stroke: 5px #000; text-shadow: ${s}px ${s}px 0 #ff4d8d; transform: skew(-6deg) rotate(${(-1 - 3 * t).toFixed(1)}deg)`,
      caption: '',
      captionStyle: '',
      legendary: false,
    };
  }
  return {
    style: 'font-size: 136px; color: #ffe433; -webkit-text-stroke: 6px #000; text-shadow: 7px 7px 0 #ff4d8d, -4px -3px 0 #3ec6e0; transform: skew(-8deg) rotate(-6deg) scale(1.05)',
    caption: 'LÉGENDAIRE !',
    captionStyle: 'color: #ffe433; text-shadow: 2px 2px 0 #ff4d8d',
    legendary: true,
  };
}
