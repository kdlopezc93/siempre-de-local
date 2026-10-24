import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A } from '../../test/me-two-teams';
import { HomePage } from './HomePage';

const player = (over: object) => ({
  userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f90',
  displayName: 'Ana',
  jerseyNumber: 4,
  preferredPositions: [],
  test: { status: 'hidden' },
  latestAssessment: null,
  assessedByMe: true,
  canRate: true,
  knowledge: [],
  card: { ratedAt: '2026-10-01T00:00:00.000Z', positionAverages: {} },
  ...over,
});

function api(squad: object[], attempts: object[] = []) {
  fakeApi({
    'GET /api/v1/me/attempts': { status: 200, body: { items: attempts } },
    'GET /api/v1/certification/positions': { status: 200, body: { positions: [] } },
    [`GET /api/v1/teams/${TEAM_A}/squad`]: { status: 200, body: { players: squad } },
    [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
  });
}

function renderHome() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <HomePage me={ME_TWO_TEAMS} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('inicio: lo que toca (07 §4.3)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('lo más urgente en el bloque ámbar; lo demás por rol, en filas', async () => {
    api([player({ assessedByMe: false }), player({ assessedByMe: false, card: null })]);
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Kevin' })).toBeInTheDocument();
    const lead = await screen.findByRole('link', { name: /Valora a 2 jugadores/ });
    expect(lead).toHaveAttribute('href', `/equipos/${TEAM_A}/plantilla?filtro=por-valorar`);
    expect(lead).toHaveTextContent('Antes de mirar su test');
    const staff = screen.getByRole('region', { name: 'Del cuerpo técnico' });
    expect(within(staff).getByRole('link', { name: /Sin tarjeta/ })).toHaveTextContent('1');
    const asPlayer = screen.getByRole('region', { name: 'Como jugador' });
    expect(within(asPlayer).getByRole('link', { name: /Haz tu test de posición/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/test`,
    );
  });

  it('sin pendientes: al día', async () => {
    api(
      [player({})],
      [
        {
          attemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f91',
          clientAttemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f92',
          teamId: TEAM_A,
          format: 'F11',
          submittedAt: '2026-10-01T00:00:00.000Z',
          winner: 'DFC',
          ranking: [{ pos: 'DFC', pct: 0.5 }],
          podium: ['DFC'],
          suggestedKnowledgeExams: [],
        },
      ],
    );
    renderHome();
    expect(await screen.findByText('Estás al día.')).toBeInTheDocument();
  });

  it('si el historial no carga, no pide el test (quizá ya lo hizo)', async () => {
    fakeApi({
      'GET /api/v1/me/attempts': { status: 500 },
      'GET /api/v1/certification/positions': { status: 200, body: { positions: [] } },
      [`GET /api/v1/teams/${TEAM_A}/squad`]: { status: 200, body: { players: [player({})] } },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
    });
    renderHome();
    expect(await screen.findByText('Estás al día.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Haz tu test/ })).toBeNull();
  });
});
