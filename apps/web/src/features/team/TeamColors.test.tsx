import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InDataRouter } from '../../test/data-router';
import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A } from '../../test/me-two-teams';
import { TeamColors } from './TeamColors';

const team = (colors: string[] | null) => ({
  team: {
    id: TEAM_A,
    name: 'Primer equipo',
    format: 'F11',
    formats: ['F11'],
    season: '2026',
    club: { id: ME_TWO_TEAMS.clubs[0]!.id, name: 'Los del Barrio' },
    ratingsVisibleToPlayers: true,
    matchRatingsVisibleToPlayers: true,
    colors,
  },
  myRoles: ['coach'],
});

function renderColors() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <InDataRouter>
        <TeamColors teamId={TEAM_A} editable />
      </InDataRouter>
    </QueryClientProvider>,
  );
}

describe('TeamColors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elige con un ejemplo, cambia uno por su código y guarda', async () => {
    let patch: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(null) },
      [`PATCH /api/v1/teams/${TEAM_A}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 200, body: team(['#0b7a3b', '#c8102e', '#ffffff']) };
      },
      'GET /api/v1/me': { status: 200, body: ME_TWO_TEAMS },
    });
    const user = userEvent.setup();
    renderColors();
    await user.click(await screen.findByRole('button', { name: 'Elegir' }));

    await user.click(screen.getByRole('button', { name: /Verde y amarillo/ }));
    expect(screen.getByRole('button', { name: /Principal, #0B7A3B/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // El secundario, por su código: con o sin #, en minúsculas o mayúsculas.
    await user.click(screen.getByRole('button', { name: /Secundario/ }));
    const code = screen.getByRole('textbox', { name: 'Código' });
    await user.clear(code);
    await user.type(code, 'C8102E');
    expect(screen.getByRole('button', { name: /Secundario, #C8102E/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(patch).toEqual({ colors: ['#0b7a3b', '#c8102e', '#ffffff'] }));
  });

  it('en RGB, cada número va de 0 a 255', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(['#c8102e', '#ffffff']) },
    });
    const user = userEvent.setup();
    renderColors();
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }));
    await user.click(screen.getByRole('button', { name: 'RGB' }));
    expect(screen.getByRole('textbox', { name: 'R' })).toHaveValue('200');

    const g = screen.getByRole('textbox', { name: 'G' });
    await user.clear(g);
    await user.type(g, '300');
    expect(screen.getByRole('alert')).toHaveTextContent('Cada número va de 0 a 255.');
    await user.clear(g);
    await user.type(g, '64');
    expect(screen.getByRole('button', { name: /Principal, #C8402E/ })).toBeInTheDocument();
  });

  it('avisa cuando un color no se va a leer sobre el fondo', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}`]: { status: 200, body: team(['#ffffff', '#ffd200']) },
    });
    const user = userEvent.setup();
    renderColors();
    await user.click(await screen.findByRole('button', { name: 'Cambiar' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'El secundario casi no se ve sobre el fondo: las cifras salen en negro.',
    );
  });
});
