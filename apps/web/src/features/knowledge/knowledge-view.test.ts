import { describe, expect, it } from 'vitest';

import { clockOffsetMs, clockTone, formatClock, remainingMs } from './knowledge-view';

describe('reloj del examen', () => {
  it('corrige la hora del celular con la del servidor', () => {
    // El celular va 2 minutos adelantado.
    const received = Date.parse('2026-10-22T10:02:00.000Z');
    const offset = clockOffsetMs('2026-10-22T10:00:00.000Z', received);
    expect(offset).toBe(-120_000);
    expect(remainingMs('2026-10-22T10:20:00.000Z', offset, received)).toBe(20 * 60_000);
    expect(remainingMs('2026-10-22T10:20:00.000Z', offset, received + 21 * 60_000)).toBe(0);
  });

  it('formato y tono', () => {
    expect(formatClock(20 * 60_000)).toBe('20:00');
    expect(formatClock(65_400)).toBe('1:06');
    expect(formatClock(9_000)).toBe('0:09');
    expect([clockTone(180_000), clockTone(120_000), clockTone(60_000)]).toEqual([
      'calm',
      'hurry',
      'last',
    ]);
  });
});
