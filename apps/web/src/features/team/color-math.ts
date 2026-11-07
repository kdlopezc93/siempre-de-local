/*
 * Las cuentas del selector de colores (2026-11-06): de HEX a RGB y a HSV (tono, saturación y
 * brillo: el cuadro y la barra) y de vuelta. Puras; el contraste de los afiches vive en el dominio.
 */

export type Rgb = readonly [number, number, number];
/** Tono 0–360, saturación y brillo 0–1. */
export type Hsv = readonly [number, number, number];

/** `#c8102e`, `C8102E`, `#fff` o `fff` → `#c8102e` / `#ffffff`; null si no es un color. */
export function parseHex(value: string): string | null {
  let s = value.trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(s)) s = [...s].map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? `#${s}` : null;
}

export const hexToRgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;

export const rgbToHex = (rgb: Rgb): string =>
  `#${rgb
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

export function rgbToHsv([r, g, b]: Rgb): Hsv {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const d = max - Math.min(rr, gg, bb);
  let h = 0;
  if (d) {
    h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  }
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

export function hsvToRgb([h, s, v]: Hsv): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return [f(5), f(3), f(1)];
}

export const hexToHsv = (hex: string): Hsv => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv: Hsv): string => rgbToHex(hsvToRgb(hsv));
