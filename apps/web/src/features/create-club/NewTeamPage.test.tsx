import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS } from '../../test/me-two-teams';
import { NewTeamPage } from './NewTeamPage';

const CLUB = ME_TWO_TEAMS.clubs[0]!.id;
const TEAM = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f90';

function renderPage(me = ME_TWO_TEAMS) {
  const router = createMemoryRouter(
    [
      { path: '/nuevo', element: <NewTeamPage me={me} clubId={CLUB} /> },
      { path: '/equipos/:teamId/invitar', element: <p>Invitar</p> },
    ],
    { initialEntries: ['/nuevo'] },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('nuevo equipo del club (2026-10-29)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lo crea y, si lo entrena otra persona, sigue a invitarla como entrenador', async () => {
    let body: unknown;
    fakeApi({
      [`POST /api/v1/clubs/${CLUB}/teams`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { teamId: TEAM } };
      },
    });
    const router = renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del equipo.');

    await userEvent.type(screen.getByLabelText('Nombre del equipo'), 'Los del jueves');
    await userEvent.click(screen.getByRole('button', { name: 'Otra persona' }));
    await userEvent.click(screen.getByRole('switch', { name: /También juego/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));
    await vi.waitFor(() => expect(router.state.location.pathname).toBe(`/equipos/${TEAM}/invitar`));
    expect(router.state.location.search).toBe('?para=entrenador');
    expect(body).toEqual({
      name: 'Los del jueves',
      format: 'F8',
      season: String(new Date().getFullYear()),
      alsoPlays: false,
    });
  });

  it('el límite de equipos lo dice el API', async () => {
    fakeApi({
      [`POST /api/v1/clubs/${CLUB}/teams`]: {
        status: 409,
        body: {
          error: {
            code: 'TEAM_LIMIT_REACHED',
            message: 'El club ya tiene 3 equipos. Para abrir otro, escríbenos.',
          },
        },
      },
    });
    renderPage();
    await userEvent.type(screen.getByLabelText('Nombre del equipo'), 'Cuarto');
    await userEvent.click(screen.getByRole('button', { name: 'Crear equipo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene 3 equipos');
  });

  it('quien no administra el club no crea equipos', () => {
    fakeApi({});
    renderPage({ ...ME_TWO_TEAMS, clubs: [] });
    expect(screen.getByRole('alert')).toHaveTextContent('Solo el dueño y los admins del club');
  });
});
