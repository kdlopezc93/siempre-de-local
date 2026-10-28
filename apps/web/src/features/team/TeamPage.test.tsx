import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { InDataRouter } from '../../test/data-router';
import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from '../../test/me-two-teams';
import { TeamPage } from './TeamPage';

function renderTeam(teamId: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <InDataRouter>
        <TeamPage me={ME_TWO_TEAMS} teamId={teamId} />
      </InDataRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el equipo, invitar e informe para quien corresponde', () => {
    renderTeam(TEAM_A);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Los del Barrio Primer equipo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Fútbol 11')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invitar jugadores' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/invitar`,
    );
    expect(screen.getByRole('link', { name: 'Informe de validación' })).toBeInTheDocument();
  });

  it('cerrar sesión ya no está aquí: va en tu cuenta', () => {
    renderTeam(TEAM_B);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    // Ahí es solo jugador, pero como dueño del club puede invitar.
    expect(screen.getByRole('link', { name: 'Invitar jugadores' })).toBeInTheDocument();
  });

  it('el coach decide si los jugadores ven su tarjeta (D8)', async () => {
    const team = (visible: boolean) => ({
      team: {
        id: TEAM_A,
        name: 'Primer equipo',
        format: 'F11',
        formats: ['F11'],
        season: '2026',
        club: { id: ME_TWO_TEAMS.clubs[0]!.id, name: 'Los del Barrio' },
        ratingsVisibleToPlayers: visible,
        matchRatingsVisibleToPlayers: true,
      },
      myRoles: ['coach', 'player'],
    });
    let patch: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(true) },
      [`PATCH /api/v1/teams/${TEAM_A}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 200, body: team(false) };
      },
    });
    renderTeam(TEAM_A);
    const toggle = await screen.findByRole('switch', { name: /Los jugadores ven su tarjeta/ });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await vi.waitFor(() => expect(toggle).not.toBeChecked());
    expect(patch).toEqual({ ratingsVisibleToPlayers: false });
    expect(screen.getByText('Solo el cuerpo técnico la ve.')).toBeInTheDocument();
  });

  it('y si ven cómo jugaron cada partido (D18)', async () => {
    const team = (visible: boolean) => ({
      team: {
        id: TEAM_A,
        name: 'Primer equipo',
        format: 'F11',
        formats: ['F11'],
        season: '2026',
        club: { id: ME_TWO_TEAMS.clubs[0]!.id, name: 'Los del Barrio' },
        ratingsVisibleToPlayers: true,
        matchRatingsVisibleToPlayers: visible,
      },
      myRoles: ['coach', 'player'],
    });
    let patch: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(true) },
      [`PATCH /api/v1/teams/${TEAM_A}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 200, body: team(false) };
      },
    });
    renderTeam(TEAM_A);
    const toggle = await screen.findByRole('switch', { name: /ven cómo jugaron cada partido/ });
    await userEvent.click(toggle);
    await vi.waitFor(() => expect(toggle).not.toBeChecked());
    expect(patch).toEqual({ matchRatingsVisibleToPlayers: false });
    expect(screen.getByText('Solo el cuerpo técnico las ve.')).toBeInTheDocument();
    // El de la tarjeta no se movió.
    expect(screen.getByRole('switch', { name: /ven su tarjeta/ })).toBeChecked();
  });

  it('datos del equipo: el coach cambia el nombre y marca que juega los dos formatos (D14)', async () => {
    const team = (over: object = {}) => ({
      team: {
        id: TEAM_A,
        name: 'Primer equipo',
        format: 'F11',
        formats: ['F11'],
        season: '2026',
        club: { id: ME_TWO_TEAMS.clubs[0]!.id, name: 'Los del Barrio' },
        ratingsVisibleToPlayers: true,
        matchRatingsVisibleToPlayers: true,
        ...over,
      },
      myRoles: ['coach', 'player'],
    });
    let patch: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team() },
      [`PATCH /api/v1/teams/${TEAM_A}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return {
          status: 200,
          body: team({ name: 'Los Pibes', formats: ['F11', 'F8'], format: 'F8' }),
        };
      },
      'GET /api/v1/me': { status: 200, body: ME_TWO_TEAMS },
    });
    renderTeam(TEAM_A);

    const data = await screen.findByRole('region', { name: 'Datos del equipo' });
    expect(data).toHaveTextContent('JuegaFútbol 11');
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const name = screen.getByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Los Pibes');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fútbol 8' }));
    // Con los dos marcados, se elige el principal.
    await userEvent.click(screen.getByRole('radio', { name: 'Fútbol 8' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() =>
      expect(patch).toEqual({ name: 'Los Pibes', formats: ['F11', 'F8'], format: 'F8' }),
    );
    expect(await screen.findByText('Fútbol 8 y 11')).toBeInTheDocument();
  });

  it('datos del equipo: el asistente los ve sin editar', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_B}`]: {
        status: 200,
        body: {
          team: {
            id: TEAM_B,
            name: 'Los del jueves',
            format: 'F8',
            formats: ['F8'],
            season: '2026',
            club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f99', name: 'Otro club' },
            ratingsVisibleToPlayers: true,
            matchRatingsVisibleToPlayers: true,
          },
          myRoles: ['player'],
        },
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <InDataRouter>
          <TeamPage me={{ ...ME_TWO_TEAMS, clubs: [] }} teamId={TEAM_B} />
        </InDataRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('region', { name: 'Datos del equipo' })).toHaveTextContent(
      'NombreLos del jueves',
    );
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
  });
});
