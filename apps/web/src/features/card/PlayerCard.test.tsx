import { positionAverages } from '@sdl/domain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlayerCard } from './PlayerCard';

const values = { PAC: 82, SHO: 64, PAS: 62, DRI: 78, DEF: 35, PHY: 58 };

describe('la tarjeta en F5 (2026-10-29)', () => {
  it('solo trae portero, cierre, ala y pívot, con sus nombres de micro', () => {
    render(
      <PlayerCard
        card={{
          values,
          position: 'MC',
          positionAverages: positionAverages(values),
          ratedAt: '2026-10-20T12:00:00Z',
        }}
        format="F5"
      />,
    );
    // Mediocentro en F5 es ala.
    expect(screen.getByText('Su posición').parentElement).toHaveTextContent(/de media como\s*Ala/);
    const list = screen.getByRole('list');
    expect([...list.querySelectorAll('li span:first-child')].map((s) => s.textContent)).toEqual([
      'Ala',
      'Pívot',
      'Cierre',
    ]);
  });
});
