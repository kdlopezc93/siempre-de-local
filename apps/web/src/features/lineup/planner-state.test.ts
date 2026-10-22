import { describe, expect, it } from 'vitest';

import {
  initialState,
  sendToBench,
  setFormation,
  tapBench,
  tapSlot,
  toggleAvailable,
  unpin,
} from './planner-state';

const at: Record<string, string | null> = { POR: 'ana', DFC: 'beto', DC: null };
const occupant = (slotId: string) => at[slotId] ?? null;

describe('planificador: armar a mano', () => {
  const base = initialState('1-3-3-1', ['ana', 'beto', 'caro']);

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
});
