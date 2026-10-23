// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Contraste WCAG 2.2 de las parejas que usan las pantallas (design-system §3.3). Lee los hex de
 * tokens.css: si alguien cambia un color y baja del mínimo, este test falla.
 */
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const color = (token: string) => {
  const hex = new RegExp(`--sdl-color-${token}:\\s*(#[0-9a-f]{6});`, 'i').exec(css)?.[1];
  if (!hex) throw new Error(`Falta --sdl-color-${token}`);
  return hex;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(color(a)), luminance(color(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

const SURFACES = ['bg', 'surface', 'surface-selected'];
/** Texto (4,5:1): todo lo que se lee sobre las tres superficies. */
const TEXT = ['chalk', 'dim', 'accent', 'green', 'blue', 'coral', 'red-text'];
/** No texto (3:1, 1.4.11): bordes de controles, aros de las fichas, foco. */
const NON_TEXT = ['border-strong', 'chalk', 'blue', 'green', 'coral', 'accent'];

describe('contraste de los tokens (WCAG 2.2 AA)', () => {
  for (const fg of TEXT) {
    for (const bg of SURFACES) {
      it(`texto ${fg} sobre ${bg} ≥ 4,5`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
    }
  }
  for (const fg of NON_TEXT) {
    for (const bg of SURFACES) {
      it(`borde o aro ${fg} sobre ${bg} ≥ 3`, () =>
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
    }
  }
  it.each([
    ['on-accent', 'accent', 'texto del bloque y del botón ámbar'],
    ['on-accent-muted', 'accent', 'detalle del bloque ámbar'],
    ['on-accent', 'red', 'botón de eliminar'],
    ['bg', 'chalk', 'filtro prendido'],
  ])('%s sobre %s (%s) ≥ 4,5', (fg, bg) => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
});
