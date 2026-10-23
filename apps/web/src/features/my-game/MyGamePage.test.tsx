import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A } from '../../test/me-two-teams';
import { MyGamePage } from './MyGamePage';

const VALUES = { PAC: 82, SHO: 64, PAS: 62, DRI: 78, DEF: 35, PHY: 58 };
const CARD = {
  card: {
    ratedAt: '2026-10-21T10:00:00.000Z',
    values: VALUES,
    positionAverages: { EXT: 74, MP: 70 },
    formulaVersion: 'rating-formula-v1',
  },
};
const ATTEMPT = {
  attemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f91',
  clientAttemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f92',
  teamId: TEAM_A,
  format: 'F11',
  submittedAt: '2026-10-10T12:00:00.000Z',
  winner: 'EXT',
  ranking: [
    { pos: 'EXT', pct: 0.86 },
    { pos: 'DC', pct: 0.74 },
    { pos: 'MP', pct: 0.61 },
  ],
  podium: ['EXT', 'DC', 'MP'],
  suggestedKnowledgeExams: [],
};
const BANK = {
  label: 'v1',
  itemsPerExam: 20,
  timeLimitSeconds: 1200,
  attemptIntervalDays: 30,
  areas: [],
};

function api(over: Record<string, { status: number; body?: unknown }> = {}) {
  fakeApi({
    'GET /api/v1/me/card': { status: 200, body: CARD },
    'GET /api/v1/me/attempts': { status: 200, body: { items: [ATTEMPT] } },
    'GET /api/v1/certification/positions': {
      status: 200,
      body: {
        positions: [
          {
            position: 'DFC',
            bank: BANK,
            best: {
              pct: 0.45,
              band: 'insufficient',
              underReview: false,
              examId: ATTEMPT.attemptId,
              submittedAt: ATTEMPT.submittedAt,
            },
            review: null,
            nextAttemptAt: '2099-11-20T12:00:00.000Z',
            activeExamId: null,
          },
          {
            position: 'MC',
            bank: BANK,
            best: null,
            review: null,
            nextAttemptAt: null,
            activeExamId: null,
          },
        ],
      },
    },
    ...over,
  });
}

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <MyGamePage me={ME_TWO_TEAMS} teamId={TEAM_A} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Mi juego (07 §4.3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tu tarjeta, tu podio (repetir es discreto) y tu conocimiento', async () => {
    api();
    renderPage();
    const card = await screen.findByRole('article', { name: 'Tarjeta del jugador' });
    expect(card).toHaveTextContent(/^74de media como Extremo/);

    const podium = await screen.findByRole('list', { name: 'Tus 3 posiciones' });
    expect(
      within(podium)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['1Extremo86%', '2Delantero centro74%', '3Mediapunta61%']);
    expect(screen.getByRole('link', { name: /Ver el resultado/ })).toHaveAttribute(
      'href',
      `/resultados/${ATTEMPT.attemptId}`,
    );
    expect(screen.getByRole('link', { name: 'Repetir el test' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Haz tu test/ })).toBeNull();

    const dfc = await screen.findByRole('link', { name: /Defensa central/ });
    expect(dfc).toHaveTextContent('45%, insuficiente');
    expect(dfc).toHaveTextContent('Desde el 20 nov');
    expect(screen.getByRole('link', { name: /Mediocentro/ })).toHaveTextContent(
      'Sin presentarPresentar',
    );
  });

  it('sin test todavía: es lo primero de tu posición', async () => {
    api({ 'GET /api/v1/me/attempts': { status: 200, body: { items: [] } } });
    renderPage();
    expect(await screen.findByRole('link', { name: /Haz tu test de posición/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/test`,
    );
  });

  it('si el equipo oculta la tarjeta, lo dice', async () => {
    api({
      'GET /api/v1/me/card': {
        status: 403,
        body: { error: { code: 'CARD_HIDDEN', message: 'Oculta' } },
      },
    });
    renderPage();
    expect(
      await screen.findByText('En tu equipo la tarjeta la ve solo el cuerpo técnico.'),
    ).toBeInTheDocument();
  });
});
