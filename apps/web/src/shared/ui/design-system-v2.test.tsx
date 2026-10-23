import { House } from '@phosphor-icons/react/dist/csr/House';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { BottomNav } from './BottomNav';
import { Chips } from './Chips';
import { teamInitials, TeamHeader } from './TeamHeader';
import { lineOfPosition, Token } from './Token';

describe('sistema de diseño v2', () => {
  it('iniciales del escudo y línea de cada posición', () => {
    expect(teamInitials('Primer equipo')).toBe('PE');
    expect(teamInitials('Los del jueves')).toBe('LJ');
    expect(teamInitials('La 14')).toBe('L1');
    expect(['POR', 'DFC', 'MC', 'DC'].map((p) => lineOfPosition(p as 'POR'))).toEqual([
      'portero',
      'defensa',
      'medio',
      'ataque',
    ]);
  });

  it('la ficha es decorativa salvo que lleve etiqueta', () => {
    const { container } = render(<Token text="4" line="defensa" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    render(<Token text="9" label="Dorsal 9" />);
    expect(screen.getByRole('img', { name: 'Dorsal 9' })).toBeInTheDocument();
  });

  it('la barra marca la pestaña actual y anuncia pendientes', () => {
    render(
      <MemoryRouter initialEntries={['/plantilla']}>
        <BottomNav
          items={[
            { to: '/', label: 'Inicio', icon: House, end: true },
            { to: '/plantilla', label: 'Plantilla', icon: UsersThree, badge: 12 },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Plantilla/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Plantilla/ })).toHaveTextContent('9+ pendientes');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('los filtros se prenden y se apagan', async () => {
    function Harness() {
      const [on, setOn] = useState<ReadonlySet<'a' | 'b'>>(new Set());
      return (
        <Chips
          label="Filtrar"
          options={[
            { value: 'a', label: 'Por valorar', count: 4 },
            { value: 'b', label: 'Defensas' },
          ]}
          selected={on}
          onToggle={(v) =>
            setOn((prev) => {
              const next = new Set(prev);
              if (next.has(v)) next.delete(v);
              else next.add(v);
              return next;
            })
          }
        />
      );
    }
    render(<Harness />);
    const chip = screen.getByRole('button', { name: 'Por valorar, 4' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('con un solo equipo el encabezado no es un botón', () => {
    const team = {
      id: 't',
      name: 'Primer equipo',
      club: 'Los del Barrio',
      format: 'Fútbol 11',
      roles: '',
    };
    render(<TeamHeader team={team} teams={[team]} onSwitch={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Los del Barrio, Fútbol 11')).toBeInTheDocument();
  });
});
