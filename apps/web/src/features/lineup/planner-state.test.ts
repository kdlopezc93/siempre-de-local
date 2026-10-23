import { describe, expect, it } from 'vitest';

import {
  fromLineup,
  fromMatch,
  initialState,
  sendToBench,
  setFormat,
  setFormation,
  tapBench,
  tapSlot,
  toggleAvailable,
  toLineupInput,
  unpin,
} from './planner-state';

const at: Record<string, string | null> = { POR: 'ana', DFC: 'beto', DC: null };
const occupant = (slotId: string) => at[slotId] ?? null;

describe('planificador: armar a mano', () => {
  const base = initialState('F8', ['ana', 'beto', 'caro']);

  it('tocar dos puestos los intercambia y deja a los dos fijados', () => {
    const one = tapSlot(base, 'POR', occupant);
    expect(one.selected).toEqual({ kind: 'slot', slotId: 'POR' });
    const two = tapSlot(one, 'DFC', occupant);
    expect(two.pins).toEqual([
      { slotId: 'DFC', playerId: 'ana' },
      { slotId: 'POR', playerId: 'beto' },
    ]);
    expect(two.selected).toBeNull();
  });

  it('mover a un puesto vacío fija solo al que se movió', () => {
    const moved = tapSlot(tapSlot(base, 'POR', occupant), 'DC', occupant);
    expect(moved.pins).toEqual([{ slotId: 'DC', playerId: 'ana' }]);
  });

  it('un suplente tocado entra al puesto que se toque después, fijado', () => {
    const benched = sendToBench(base, 'caro');
    const armed = tapBench(benched, 'caro');
    const placed = tapSlot(armed, 'DFC', occupant);
    expect(placed.pins).toEqual([{ slotId: 'DFC', playerId: 'caro' }]);
    expect(placed.benched.has('caro')).toBe(false);
  });

  it('soltar, mandar a la banca, desconvocar y cambiar de formación limpian los fijados', () => {
    const pinned = tapSlot(tapSlot(base, 'POR', occupant), 'DFC', occupant);
    expect(unpin(pinned, 'POR').pins).toEqual([{ slotId: 'DFC', playerId: 'ana' }]);
    const toBench = sendToBench(pinned, 'ana');
    expect(toBench.pins).toEqual([{ slotId: 'POR', playerId: 'beto' }]);
    expect(toBench.benched.has('ana')).toBe(true);
    const out = toggleAvailable(pinned, 'beto');
    expect(out.available.has('beto')).toBe(false);
    expect(out.pins).toEqual([{ slotId: 'DFC', playerId: 'ana' }]);
    expect(setFormation(pinned, '1-2-4-1').pins).toEqual([]);
  });

  it('tocar el mismo puesto o el mismo suplente dos veces deselecciona', () => {
    expect(tapSlot(tapSlot(base, 'POR', occupant), 'POR', occupant).selected).toBeNull();
    expect(tapBench(tapBench(base, 'caro'), 'caro').selected).toBeNull();
  });

  it('cambiar a F11 pone su formación por defecto y suelta los fijados', () => {
    expect(base.formationKey).toBe('1-3-3-1');
    const pinned = tapSlot(tapSlot(base, 'POR', occupant), 'DFC', occupant);
    const f11 = setFormat(pinned, 'F11');
    expect(f11).toMatchObject({ format: 'F11', formationKey: '1-4-3-3', pins: [] });
    expect(setFormat(f11, 'F11')).toBe(f11);
  });
});

describe('guardar y abrir', () => {
  const saved = {
    id: 'l1',
    name: 'Fecha 3',
    matchDate: '2026-11-01',
    matchId: null,
    format: 'F8' as const,
    formation: '1-2-4-1',
    mode: 'performance' as const,
    weights: { A: 0.05, V: 0.3, C: 0.15, R: 0.5 },
    priority: 'defensa' as const,
    minKnowledgePct: 0.7,
    fitVersion: 'fit-v1',
    available: ['ana', 'beto', 'ido'],
    pins: [],
    assignments: [
      { slotId: 'POR', playerId: 'ana', fit: 0.8, breakdown: {}, pinned: false, manual: false },
      { slotId: 'DFC-1', playerId: 'ido', fit: 0.5, breakdown: {}, pinned: false, manual: false },
      { slotId: 'DFC-2', playerId: null, fit: null, breakdown: null, pinned: false, manual: false },
    ],
    bench: ['beto'],
    createdBy: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
  };

  it('abrir la deja tal cual, con todos fijados; quien ya no está queda fuera', () => {
    const state = fromLineup(saved, ['ana', 'beto']);
    expect(state).toMatchObject({
      format: 'F8',
      formationKey: '1-2-4-1',
      mode: 'performance',
      priority: 'defensa',
      minKnowledgePct: 0.7,
      pins: [{ slotId: 'POR', playerId: 'ana' }],
    });
    expect([...state.available]).toEqual(['ana', 'beto']);
    expect([...state.benched]).toEqual(['beto']);
  });

  it('guardar arma la foto: lo fijado a mano queda marcado', () => {
    const state = { ...initialState('F8', ['ana']), pins: [{ slotId: 'POR', playerId: 'ana' }] };
    const input = toLineupInput(
      state,
      {
        assignments: [
          { slotId: 'POR', playerId: 'ana', fit: 0.8, breakdown: { V: 1 }, pinned: true },
          { slotId: 'DC', playerId: null, fit: null, breakdown: null, pinned: false },
        ],
        bench: [],
        warnings: [],
      },
      { name: '  Fecha 4 ', matchDate: '2026-11-08' },
    );
    expect(input).toMatchObject({
      name: 'Fecha 4',
      matchDate: '2026-11-08',
      matchId: null,
      formation: '1-3-3-1',
      fitVersion: 'fit-v1',
      available: ['ana'],
      assignments: [
        { slotId: 'POR', playerId: 'ana', manual: true },
        { slotId: 'DC', playerId: null, manual: false },
      ],
    });
  });
});

describe('desde un partido (Fase 7)', () => {
  it('su formato y, convocados, los que dijeron voy', () => {
    const state = fromMatch(
      { format: 'F11' },
      [
        { playerId: 'ana', reply: 'yes' },
        { playerId: 'beto', reply: 'no' },
        { playerId: 'ciro', reply: null },
      ],
      ['ana', 'beto', 'ciro', 'dani'],
    );
    expect(state).toMatchObject({ format: 'F11', formationKey: '1-4-3-3' });
    expect([...state.available]).toEqual(['ana']);
  });
});
