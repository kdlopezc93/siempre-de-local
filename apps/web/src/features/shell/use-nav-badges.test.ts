import { describe, expect, it } from 'vitest';

import { navBadges } from './use-nav-badges';

describe('los globos de la barra (2026-10-30)', () => {
  it('Partidos: convocatorias abiertas sin responder; Mi juego: cobros por pagar; Equipo: pagos por confirmar', () => {
    expect(
      navBadges({
        matches: [
          { open: true, myReply: null },
          { open: true, myReply: 'yes' },
          { open: false, myReply: null },
        ],
        myCharges: {
          items: [{ status: 'pending' }, { status: 'partial' }, { status: 'paid' }] as never,
        },
        reported: 2,
      }),
    ).toEqual({ partidos: 1, 'mi-juego': 2, equipo: 2 });
  });

  it('sin pendientes, sin globos (y sin datos, tampoco)', () => {
    expect(navBadges({ matches: [], myCharges: { items: [] }, reported: 0 })).toEqual({});
    expect(navBadges({ matches: null, myCharges: null, reported: null })).toEqual({});
  });
});
