import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A } from '../../test/me-two-teams';
import { ClubPage } from './ClubPage';

const CLUB = ME_TWO_TEAMS.clubs[0]!.id;
const OTHER = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f99';
const team = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  category: null,
  format: 'F8',
  season: '2026',
  archived: false,
  members: 12,
  ...extra,
});
const club = (extra: object = {}) => ({
  club: { id: CLUB, name: 'Los del Barrio', city: null, ...extra },
  myRole: 'owner',
  teams: [team(TEAM_A, 'Primer equipo', { category: 'Libre' }), team(OTHER, 'Los del jueves')],
  admins: [{ userId: ME_TWO_TEAMS.user.id, name: 'Kevin López', role: 'owner' }],
  candidates: [{ userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f55', name: 'Stiven Rios' }],
});

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/c', element: <ClubPage me={ME_TWO_TEAMS} clubId={CLUB} /> }],
    { initialEntries: ['/c'] },
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
}

describe('el club (2026-10-29)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra sus equipos y abre los tuyos; con cupo, deja crear otro', async () => {
    fakeApi({ [`GET /api/v1/clubs/${CLUB}`]: { status: 200, body: club() } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Equipos (2 de 3)' })).toBeInTheDocument();
    expect(screen.getByText('Sin ciudad todavía')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Primer equipo/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/equipo`,
    );
    // En "Los del jueves" no estás: no se abre desde aquí.
    expect(screen.queryByRole('link', { name: /Los del jueves/ })).toBeNull();
    expect(screen.getByText(/Fútbol 8 · Libre · 2026 · 12 personas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo equipo' })).toHaveAttribute(
      'href',
      `/clubes/${CLUB}/nuevo-equipo`,
    );
  });

  it('edita el nombre y la ciudad', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/clubs/${CLUB}`]: { status: 200, body: club() },
      [`PATCH /api/v1/clubs/${CLUB}`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 200, body: club({ city: 'Bosa' }) };
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la ciudad o el barrio.');
    await userEvent.type(screen.getByLabelText('Ciudad o barrio'), 'Bosa');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Bosa', { selector: 'dd' })).toBeInTheDocument();
    expect(body).toEqual({ name: 'Los del Barrio', city: 'Bosa' });
  });

  it('con 3 equipos activos ya no ofrece crear otro', async () => {
    fakeApi({
      [`GET /api/v1/clubs/${CLUB}`]: {
        status: 200,
        body: {
          ...club(),
          teams: [
            team(TEAM_A, 'A'),
            team(OTHER, 'B'),
            team('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f98', 'C'),
          ],
        },
      },
    });
    renderPage();
    expect(await screen.findByText(/ya tiene 3 equipos/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nuevo equipo' })).toBeNull();
  });

  it('archivar pide confirmar; desarchivar sin cupo lo explica', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/clubs/${CLUB}`]: { status: 200, body: club() },
      [`PATCH /api/v1/clubs/${CLUB}/teams/${OTHER}`]: (init) => {
        body = JSON.parse(init.body as string);
        return (body as { archived: boolean }).archived
          ? {
              status: 200,
              body: {
                ...club(),
                teams: [
                  team(TEAM_A, 'Primer equipo', { category: 'Libre' }),
                  team(OTHER, 'Los del jueves', { archived: true }),
                ],
              },
            }
          : {
              status: 409,
              body: {
                error: {
                  code: 'TEAM_LIMIT_REACHED',
                  message:
                    'El club ya tiene 3 equipos activos. Archiva otro antes de volver a abrir este.',
                },
              },
            };
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Archivar Los del jueves' }));
    const sheet = screen.getByRole('dialog', { name: '¿Archivar Los del jueves?' });
    expect(sheet).toHaveTextContent('Deja de verse para sus 12 integrantes. Libera un cupo');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Sí, archivar' }));
    expect(body).toEqual({ archived: true });
    expect(await screen.findByText(/Archivado/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipos (1 de 3)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desarchivar Los del jueves' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Archiva otro antes');
  });

  it('el dueño nombra admin a un integrante y se lo quita', async () => {
    const STIVEN = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f55';
    const withAdmin = {
      ...club(),
      admins: [
        { userId: ME_TWO_TEAMS.user.id, name: 'Kevin López', role: 'owner' },
        { userId: STIVEN, name: 'Stiven Rios', role: 'admin' },
      ],
      candidates: [],
    };
    const { calls } = fakeApi({
      [`GET /api/v1/clubs/${CLUB}`]: { status: 200, body: club() },
      [`POST /api/v1/clubs/${CLUB}/admins`]: { status: 201, body: withAdmin },
      [`DELETE /api/v1/clubs/${CLUB}/admins/${STIVEN}`]: { status: 200, body: club() },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Nombrar admin' }));
    const sheet = screen.getByRole('dialog', { name: '¿A quién nombras admin?' });
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Stiven Rios' }));
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Nombrar admin a Stiven Rios' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Quitar admin a Stiven Rios' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await vi.waitFor(() =>
      expect(calls).toContain(`DELETE /api/v1/clubs/${CLUB}/admins/${STIVEN}`),
    );
    // Al dueño no se le quita.
    expect(screen.queryByRole('button', { name: /Quitar admin a Kevin/ })).toBeNull();
  });

  it('a quien no es del club le explica', async () => {
    fakeApi({
      [`GET /api/v1/clubs/${CLUB}`]: {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: 'x' } },
      },
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el dueño y los admins');
  });
});
