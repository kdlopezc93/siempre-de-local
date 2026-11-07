import { describe, expect, it } from 'vitest';

import { hexToHsv, hexToRgb, hsvToHex, parseHex, rgbToHex } from './color-math';

describe('parseHex', () => {
  it('acepta con o sin #, en mayúsculas y en 3 dígitos', () => {
    expect(parseHex('#C8102E')).toBe('#c8102e');
    expect(parseHex(' c8102e ')).toBe('#c8102e');
    expect(parseHex('#FFF')).toBe('#ffffff');
    expect(parseHex('0a4')).toBe('#00aa44');
  });

  it('rechaza lo que no es un color', () => {
    expect(parseHex('rojo')).toBeNull();
    expect(parseHex('#c8102')).toBeNull();
    expect(parseHex('#c8102eff')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('conversiones', () => {
  it('HEX ↔ RGB', () => {
    expect(hexToRgb('#c8102e')).toEqual([200, 16, 46]);
    expect(rgbToHex([200, 16, 46])).toBe('#c8102e');
    expect(rgbToHex([300, -4, 12.6])).toBe('#ff000d');
  });

  it('HEX → HSV → HEX vuelve al mismo color', () => {
    for (const hex of [
      '#c8102e',
      '#ffd200',
      '#0b7a3b',
      '#8fd3ff',
      '#141414',
      '#ffffff',
      '#000000',
    ]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it('el rojo puro tiene tono 0 y está saturado y brillante', () => {
    expect(hexToHsv('#ff0000')).toEqual([0, 1, 1]);
  });
});
