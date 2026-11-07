import { describe, expect, it } from 'vitest';

import { contrastRatio, posterPalette, textOn } from './team-colors.js';

describe('posterPalette', () => {
  it('sin colores, los de la app: cobalto, texto blanco y cifras volt', () => {
    expect(posterPalette(null)).toMatchObject({
      bg: '#3155e8',
      fg: '#ffffff',
      accent: '#d4f34a',
      onAccent: '#14161c',
      band: '#d4f34a',
    });
  });

  it('un fondo claro lleva texto en tinta', () => {
    const p = posterPalette(['#f4f6fb', '#1d3fbf']);
    expect(p.fg).toBe('#14161c');
    expect(p.accent).toBe('#1d3fbf');
    expect(p.onAccent).toBe('#ffffff');
  });

  it('si el secundario no se lee sobre el fondo, las cifras salen en el color del texto', () => {
    const p = posterPalette(['#ffffff', '#ffd200']);
    expect(p.accent).toBe(p.fg);
    expect(p.accent).toBe('#14161c');
  });

  it('el tercero va en la franja; sin tercero (o si no se distingue), el secundario', () => {
    expect(posterPalette(['#c8102e', '#ffffff', '#111111']).band).toBe('#111111');
    expect(posterPalette(['#c8102e', '#ffffff']).band).toBe('#ffffff');
    expect(posterPalette(['#c8102e', '#ffffff', '#c8102f']).band).toBe('#ffffff');
  });

  it('ignora colores mal escritos o incompletos', () => {
    expect(posterPalette(['#3155e8']).accent).toBe('#d4f34a');
    expect(posterPalette(['rojo', 'azul']).bg).toBe('#3155e8');
  });

  it('el texto secundario queda entre el texto y el fondo', () => {
    const p = posterPalette(['#000000', '#ff7a00']);
    expect(p.fg).toBe('#ffffff');
    expect(contrastRatio(p.soft, p.bg)).toBeGreaterThan(4.5);
    expect(contrastRatio(p.soft, p.bg)).toBeLessThan(contrastRatio(p.fg, p.bg));
  });
});

describe('textOn', () => {
  it('blanco sobre oscuro, tinta sobre claro', () => {
    expect(textOn('#141414')).toBe('#ffffff');
    expect(textOn('#ffd200')).toBe('#14161c');
  });
});
