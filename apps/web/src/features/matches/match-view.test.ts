import type { Match } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { fromLocalInputs, slotName, splitMatches, toLocalInputs } from './match-view';

const match = (id: string, startsAt: string, open: boolean): Match => ({
  id,
  kind: 'friendly',
  tournament: null,
  format: 'F11',
  startsAt,
  place: 'La 14',
  opponent: id,
  status: open ? 'scheduled' : 'cancelled',
  open,
  editable: open,
  createdBy: null,
  replies: { yes: 0, no: 0, pending: 0, injured: 0 },
  myReply: null,
  published: null,
  result: null,
  myRating: null,
  attendanceTaken: false,
});

describe('partidos en la app', () => {
  it('próximos (el más cercano primero) y pasados (el más reciente primero)', () => {
    const { upcoming, past } = splitMatches([
      match('lejos', '2026-11-15T15:00:00.000Z', true),
      match('cerca', '2026-11-01T15:00:00.000Z', true),
      match('viejo', '2026-10-01T15:00:00.000Z', false),
      match('reciente', '2026-10-20T15:00:00.000Z', false),
    ]);
    expect(upcoming.map((m) => m.id)).toEqual(['cerca', 'lejos']);
    expect(past.map((m) => m.id)).toEqual(['reciente', 'viejo']);
  });

  it('el formulario va y viene en la hora local, sin correrse', () => {
    const iso = fromLocalInputs('2026-11-01', '15:30')!;
    expect(toLocalInputs(iso)).toEqual({ date: '2026-11-01', time: '15:30' });
    expect(fromLocalInputs('2026-11-01', '')).toBeNull();
    expect(fromLocalInputs('mañana', '15:30')).toBeNull();
  });
});

describe('el puesto en palabras', () => {
  it('con su banda, y en F5 con los nombres de micro (2026-10-29)', () => {
    expect(slotName({ position: 'LAT', side: 'izquierda' })).toBe('Lateral por la izquierda');
    expect(slotName({ position: 'EXT', side: 'derecha' }, 'F5')).toBe('Ala por la derecha');
    expect(slotName({ position: 'DFC' }, 'F5')).toBe('Cierre');
    expect(slotName({ position: 'DFC' }, 'F8')).toBe('Defensa central');
  });
});
