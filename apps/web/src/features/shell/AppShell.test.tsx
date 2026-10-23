import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from '../../test/me-two-teams';
import { AppShell } from './AppShell';

function renderAt(path: string) {
  const page = (name: string) => (
    <AppShell me={ME_TWO_TEAMS}>
      <main>{name}</main>
    </AppShell>
  );
  const router = createMemoryRouter(
    [
      { path: '/', element: page('inicio') },
      { path: '/equipos/:teamId/plantilla', element: page('plantilla') },
      { path: '/equipos/:teamId/mi-juego', element: page('mi juego') },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('armazón: equipo arriba, pestañas del rol abajo (07 §4)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('muestra el equipo de la URL y las pestañas de tu rol en él', () => {
    renderAt(`/equipos/${TEAM_A}/plantilla`);
    expect(
      screen.getByRole('button', { name: /Primer equipo\. Cambiar de equipo/ }),
    ).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Inicio', 'Plantilla', 'Partidos', 'Mi juego', 'Equipo']);
    expect(within(nav).getByRole('link', { name: 'Plantilla' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('en el inicio usa el último equipo que usaste en este celular', () => {
    localStorage.setItem('sdl.equipoActivo', TEAM_B);
    renderAt('/');
    expect(screen.getByRole('button', { name: /Los del jueves\. Cambiar/ })).toBeInTheDocument();
    // Ahí solo es jugador: sin plantilla.
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['Inicio', 'Partidos', 'Mi juego', 'Equipo']);
  });

  it('al cambiar de equipo va a la misma pestaña si tu rol allá la tiene; si no, al inicio', async () => {
    const router = renderAt(`/equipos/${TEAM_A}/plantilla`);
    await userEvent.click(screen.getByRole('button', { name: /Cambiar de equipo/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Los del jueves/ }));
    expect(router.state.location.pathname).toBe('/');
    expect(localStorage.getItem('sdl.equipoActivo')).toBe(TEAM_B);
  });
});
