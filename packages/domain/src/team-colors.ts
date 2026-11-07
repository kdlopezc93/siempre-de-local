/*
 * Los colores del equipo (2026-11-06, Kevin): dos o tres, los elige el cuerpo técnico y salen en
 * todos los afiches. El principal es el fondo; el secundario, las cifras y los discos; el tercero
 * (opcional), la franja y las etiquetas. El texto sale en blanco o en negro según el fondo, y si
 * un color no se lee sobre el fondo, cae al color del texto: nunca un afiche ilegible.
 */

/** `#rrggbb` en minúsculas. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** Los de la app (cobalto y volt): los de un equipo que no eligió. */
export const APP_COLORS = ['#3155e8', '#d4f34a'] as const;

const WHITE = '#ffffff';
const INK = '#14161c';
/** Debajo de esto, el secundario no se distingue del fondo y las cifras salen en el color del texto. */
const MIN_ACCENT_CONTRAST = 2.2;
/** La franja es un bloque grande: le basta con distinguirse un poco. */
const MIN_BAND_CONTRAST = 1.6;

export interface PosterPalette {
  /** El fondo. */
  bg: string;
  /** El texto principal: blanco o tinta. */
  fg: string;
  /** El texto secundario: el del texto, un poco hacia el fondo. */
  soft: string;
  /** Las cifras y los discos. */
  accent: string;
  /** El texto encima de `accent`. */
  onAccent: string;
  /** La franja y las etiquetas. */
  band: string;
  onBand: string;
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** El contraste WCAG entre dos colores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Blanco o tinta, el que más se lea sobre `hex`. */
export const textOn = (hex: string): string =>
  contrastRatio(hex, WHITE) >= contrastRatio(hex, INK) ? WHITE : INK;

/** `amount` de `a` y el resto de `b`, en `#rrggbb`. */
function mix(a: string, b: string, amount: number): string {
  const [ca, cb] = [channels(a), channels(b)];
  return `#${ca
    .map((c, i) => Math.round(c * amount + cb[i]! * (1 - amount)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Los colores de los afiches a partir de los del equipo (o los de la app si no eligió). */
export function posterPalette(colors: readonly string[] | null | undefined): PosterPalette {
  const valid = colors?.length && colors.length >= 2 && colors.every((c) => HEX_COLOR.test(c));
  const [bg, second, third] = valid ? colors : APP_COLORS;
  const fg = textOn(bg!);
  const accent = contrastRatio(second!, bg!) >= MIN_ACCENT_CONTRAST ? second! : fg;
  const band = third && contrastRatio(third, bg!) >= MIN_BAND_CONTRAST ? third : accent;
  return {
    bg: bg!,
    fg,
    soft: mix(fg, bg!, 0.72),
    accent,
    onAccent: textOn(accent),
    band,
    onBand: textOn(band),
  };
}
