import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS } from '../../test/me-two-teams';
import { ME_SCHOOL, SCHOOL, schoolClub, VENUE } from '../../test/school-fixture';
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

describe('nuevo grupo de una escuela (2026-11-07)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('en una categoría que ya existe: sus años y la letra siguiente', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() },
      [`POST /api/v1/clubs/${SCHOOL}/teams`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { teamId: TEAM } };
      },
    });
    const router = renderPage(ME_SCHOOL);
    expect(await screen.findByRole('heading', { name: /Nuevo grupo/ })).toBeInTheDocument();
    // La primera es Mayores; elige Sub-12, que ya tiene un masculino.
    await userEvent.click(screen.getByRole('radio', { name: /Sub-12/ }));
    expect(screen.getByLabelText(/Nombre del grupo/)).toHaveValue('Masculino B');
    await userEvent.selectOptions(screen.getByLabelText('Sede'), VENUE);
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));
    expect(body).toEqual({
      name: 'Sub-12 masculino B',
      category: 'Sub-12',
      birthYears: { from: 2014, to: 2015 },
      gender: 'male',
      format: 'F8',
      season: String(new Date().getFullYear()),
      alsoPlays: false,
      venueId: VENUE,
    });
    await screen.findByText('Invitar');
    expect(router.state.location.pathname).toBe(`/equipos/${TEAM}/invitar`);
  });

  it('en una categoría nueva, con sus años', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() },
      [`POST /api/v1/clubs/${SCHOOL}/teams`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { teamId: TEAM } };
      },
    });
    renderPage(ME_SCHOOL);
    await userEvent.click(await screen.findByRole('radio', { name: 'Nueva categoría' }));
    await userEvent.selectOptions(screen.getByLabelText('Desde'), '2018');
    await userEvent.selectOptions(screen.getByLabelText('Hasta'), '2019');
    await userEvent.click(screen.getByRole('button', { name: 'Mixto' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }));
    const sub = `Sub-${new Date().getFullYear() - 2018}`;
    expect(body).toMatchObject({
      name: sub,
      category: sub,
      birthYears: { from: 2018, to: 2019 },
      gender: 'mixed',
    });
  });
});
