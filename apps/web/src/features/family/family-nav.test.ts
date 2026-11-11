import type { Child, Match } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { firstName, homeKid, kidPath, kidSeats, kidTabOf, nextCall } from './family-nav';

const CHILD: Child = {
  id: 'n1',
  name: 'Sofía Ramírez',
  birthYear: 2017,
  relationship: 'mother',
  teams: [
    {
      team: { id: 't1', name: 'Sub-10 femenino' },
      club: { id: 'c1', name: 'Semillas del Sur', kind: 'school' },
    },
  ],
};

const match = (over: Partial<Match>): Match =>
  ({
    id: 'm',
    kind: 'training',
    status: 'scheduled',
    open: true,
    myReply: null,
    startsAt: '2026-11-14T13:00:00.000Z',
    ...over,
  }) as Match;

describe('la app del acudiente (2026-11-10)', () => {
  it('cada hijo en cada grupo es un puesto, con su nombre de pila', () => {
    expect(firstName('  Sofía  Ramírez ')).toBe('Sofía');
    expect(kidSeats([CHILD])).toEqual([
      { id: 'n1', teamId: 't1', name: 'Sofía', group: 'Sub-10 femenino, Semillas del Sur' },
    ]);
  });

  it('rutas y pestañas', () => {
    const seat = { id: 'n1', teamId: 't1' };
    expect(kidPath(seat)).toBe('/deportistas/n1/equipos/t1');
    expect(kidPath(seat, 'cuentas')).toBe('/deportistas/n1/equipos/t1/cuentas');
    expect(kidTabOf('/deportistas/n1/equipos/t1/partidos/m1')).toBe('partidos');
    expect(kidTabOf('/deportistas/n1/equipos/t1/cuentas')).toBe('cuentas');
    expect(kidTabOf('/deportistas/n1/equipos/t1')).toBe('inicio');
  });

  it('"/" abre el último hijo que vio; sin equipos propios, el primero', () => {
    const seats = kidSeats([CHILD]);
    expect(homeKid(seats, true, null)).toBeNull();
    expect(homeKid(seats, false, null)).toEqual(seats[0]);
    expect(homeKid(seats, true, { id: 'n1', teamId: 't1' })).toEqual(seats[0]);
    // Un hijo que ya no está en ese grupo no cuenta.
    expect(homeKid(seats, true, { id: 'n1', teamId: 'otro' })).toBeNull();
    expect(homeKid([], false, null)).toBeNull();
  });

  it('lo que toca: la primera convocatoria sin responder', () => {
    const items = [
      match({ id: 'a', startsAt: '2026-11-14T13:00:00.000Z', myReply: 'yes' }),
      match({ id: 'b', startsAt: '2026-11-16T13:00:00.000Z' }),
      match({ id: 'c', startsAt: '2026-11-18T13:00:00.000Z' }),
      match({ id: 'x', status: 'cancelled', open: false }),
    ];
    expect(nextCall(items)).toMatchObject({ lead: { id: 'b' }, unanswered: 2 });
    // Todas respondidas: la más próxima.
    expect(nextCall([items[0]!])).toMatchObject({ lead: { id: 'a' }, unanswered: 0 });
    expect(nextCall([])).toEqual({ lead: null, unanswered: 0 });
  });
});
