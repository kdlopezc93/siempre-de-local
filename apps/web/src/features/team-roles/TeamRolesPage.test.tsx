import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { teamPeople } from './roles-view';
import { TeamRolesPage } from './TeamRolesPage';

const KEVIN = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc1';
const JUAN = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc2';
const ANA = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb1';
const player = (userId: string, displayName: string, jerseyNumber: number | null) => ({
  userId,
  displayName,
  jerseyNumber,
  injured: false,
  bestBand: null,
});
const MEMBERS = {
  staff: [
    { userId: KEVIN, displayName: 'Kevin López', role: 'coach' },
    { userId: JUAN, displayName: 'Juan Pérez', role: 'assistant' },
  ],
  players: [player(ANA, 'Ana', 4), player(KEVIN, 'Kevin López', 11)],
} as const;
const team = (myRoles: string[]) => ({
  team: {
    id: TEAM_A,
    name: 'QLeones FC',
    format: 'F8',
    formats: ['F8'],
    season: '2026',
    club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f10', name: 'Los del Barrio' },
    ratingsVisibleToPlayers: true,
    matchRatingsVisibleToPlayers: true,
  },
  myRoles,
});

function renderPage(myRoles: string[], routes: Parameters<typeof fakeApi>[0] = {}) {
  const api = fakeApi({
    [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(myRoles) },
    [`GET /api/v1/teams/${TEAM_A}/members`]: { status: 200, body: MEMBERS },
    ...routes,
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <TeamRolesPage teamId={TEAM_A} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return api;
}

describe('cuerpo técnico y roles (2026-10-29)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cada persona una vez: primero el entrenador, después los asistentes y los jugadores', () => {
    expect(
      teamPeople(MEMBERS as never).map((p) => [p.displayName, p.coach, p.assistant, p.player]),
    ).toEqual([
      ['Kevin López', true, false, true],
      ['Juan Pérez', false, true, false],
      ['Ana', false, false, true],
    ]);
  });

  it('el entrenador sube a una jugadora a asistente; nadie queda sin rol', async () => {
    let body: unknown;
    renderPage(['coach', 'player'], {
      [`PATCH /api/v1/teams/${TEAM_A}/members/${ANA}/roles`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 204 };
      },
    });

    // El entrenador no tiene interruptor de asistente: ya es del cuerpo técnico.
    expect(await screen.findByRole('switch', { name: 'Juega: Kevin López' })).toBeChecked();
    expect(screen.queryByRole('switch', { name: 'Asistente: Kevin López' })).toBeNull();
    // Su único rol no se apaga: saldría del equipo.
    expect(screen.getByRole('switch', { name: 'Asistente: Juan Pérez' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Juega: Ana' })).toBeDisabled();

    await userEvent.click(screen.getByRole('switch', { name: 'Asistente: Ana' }));
    await vi.waitFor(() => expect(body).toEqual({ assistant: true }));
  });

  it('pasar el mando: elige a quién y dice que el anterior queda de asistente', async () => {
    let body: unknown;
    renderPage(['coach', 'player'], {
      [`PUT /api/v1/teams/${TEAM_A}/coach`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 204 };
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar el mando' }));
    const sheet = screen.getByRole('dialog', { name: '¿A quién le pasas el mando?' });
    expect(within(sheet).getByRole('button', { name: 'Elige a alguien' })).toBeDisabled();
    expect(sheet).toHaveTextContent('Kevin López queda de asistente y sigue jugando.');
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Juan Pérez' }));
    await userEvent.click(
      within(sheet).getByRole('button', { name: 'Pasarle el mando a Juan Pérez' }),
    );
    await vi.waitFor(() => expect(body).toEqual({ userId: JUAN }));
  });

  it('un asistente o un jugador no cambian roles', async () => {
    renderPage(['assistant', 'player']);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo el entrenador y los administradores del club cambian los roles.',
    );
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
