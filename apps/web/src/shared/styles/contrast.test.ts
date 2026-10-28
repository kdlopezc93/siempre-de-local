// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Contraste WCAG 2.2 de las parejas que usan las pantallas (design-system §3.3), en claro y en
 * oscuro. Lee los hex de tokens.css: si alguien cambia un color y baja del mínimo, este test falla.
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

const THEMES = {
  claro: {
    /** Lienzo, tarjeta y lo seleccionado. */
    surfaces: ['ink-50', 'white', 'ink-100'],
    /** Texto (4,5:1): fg, fg-muted, primary, success, danger. */
    text: ['ink-900', 'ink-500', 'cobalt-500', 'success-700', 'danger-600'],
    /** No texto (3:1, 1.4.11): borde de controles, aros de las fichas, foco. */
    nonText: ['ink-400', 'ink-900', 'cobalt-500', 'grass-600', 'attack-600'],
    pairs: [
      ['white', 'cobalt-500', 'texto del bloque y del botón cobalto'],
      ['cobalt-100', 'cobalt-500', 'detalle del bloque cobalto'],
      ['ink-900', 'volt-500', 'pestaña activa y acento volt'],
      ['ink-300', 'ink-900', 'pestañas de la barra de tinta'],
      ['white', 'danger-600', 'botón de eliminar'],
      ['white', 'field', 'nombres sobre el pasto'],
      ['volt-500', 'field', 'lo destacado sobre el pasto'],
      ['success-700', 'success-100', 'insignia "Al día"'],
      ['warning-700', 'orange-100', 'insignia "Pendiente"'],
      ['danger-600', 'danger-100', 'insignia "Vencido"'],
      ['cobalt-600', 'cobalt-100', 'insignia de marca'],
      ['ink-500', 'ink-100', 'insignia neutra'],
      ['white', 'live-500', 'globo de avisos'],
      ['ink-900', 'volt-300', 'iniciales sobre tinte volt'],
      ['ink-900', 'sun-300', 'iniciales sobre tinte sol'],
      ['ink-900', 'coral-300', 'iniciales sobre tinte coral'],
      ['ink-900', 'lilac-300', 'iniciales sobre tinte lila'],
      ['ink-900', 'aqua-100', 'iniciales sobre tinte agua'],
      ['ink-900', 'cobalt-100', 'iniciales sobre tinte cobalto'],
      ['ink-900', 'coral-500', 'tarjeta coral'],
      ['ink-900', 'sun-500', 'tarjeta sol'],
    ],
  },
  oscuro: {
    surfaces: ['night-950', 'night-900', 'night-800'],
    text: ['fog-50', 'fog-300', 'cobalt-300', 'success-300', 'danger-300'],
    nonText: ['night-500', 'fog-50', 'cobalt-300', 'aqua-500', 'attack-300'],
    pairs: [
      ['white', 'cobalt-500', 'bloque protagonista y botón principal (--sdl-brand)'],
      ['cobalt-100', 'cobalt-500', 'detalle del bloque protagonista'],
      ['ink-900', 'cobalt-300', 'texto sobre relleno --sdl-primary'],
      ['ink-700', 'cobalt-300', 'detalle del bloque cobalto'],
      ['ink-900', 'volt-500', 'pestaña activa y acento volt'],
      ['fog-300', 'night-800', 'pestañas de la barra'],
      ['ink-900', 'danger-300', 'botón de eliminar'],
      ['white', 'field-dark', 'nombres sobre el pasto'],
      ['volt-500', 'field-dark', 'lo destacado sobre el pasto'],
      ['success-300', 'success-night', 'insignia "Al día"'],
      ['warning-300', 'warning-night', 'insignia "Pendiente"'],
      ['danger-300', 'danger-night', 'insignia "Vencido"'],
      ['cobalt-200', 'cobalt-night', 'insignia de marca'],
      ['fog-300', 'night-800', 'insignia neutra'],
      ['white', 'live-500', 'globo de avisos'],
    ],
  },
} as const;

describe.each(Object.entries(THEMES))('contraste de los tokens, tema %s (WCAG 2.2 AA)', (_, t) => {
  for (const fg of t.text) {
    for (const bg of t.surfaces) {
      it(`texto ${fg} sobre ${bg} ≥ 4,5`, () => expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
    }
  }
  for (const fg of t.nonText) {
    for (const bg of t.surfaces) {
      it(`borde o aro ${fg} sobre ${bg} ≥ 3`, () =>
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3));
    }
  }
  for (const [fg, bg, what] of t.pairs) {
    it(`${fg} sobre ${bg} (${what}) ≥ 4,5`, () =>
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5));
  }
});
