import 'fake-indexeddb/auto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../../shared/api/auth';
import { enqueue, resetOutboxForTests } from '../../shared/offline/outbox';
import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { HistoryPage } from './HistoryPage';
import { DEFAULT_PROFILE } from '../../test/me-fixture';

const TEAM_ID = uuid(9);
const ME: Me = {
  user: { id: uuid(8), name: 'Kevin', email: 'k@example.com' },
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  teams: [
    {
      team: { id: TEAM_ID, name: 'Primer equipo', format: 'F11', formats: ['F11'], season: '2026' },
      club: { id: uuid(10), name: 'Los del Barrio' },
      roles: ['player'],
    },
  ],
  profile: DEFAULT_PROFILE,
  clubs: [],
};

const official = (n: number, submittedAt: string, podium: string[]) => ({
  attemptId: uuid(200 + n),
  clientAttemptId: uuid(300 + n),
  teamId: TEAM_ID,
  format: 'F11',
  submittedAt,
  winner: podium[0],
  ranking: podium.map((pos) => ({ pos, pct: 0.5 })),
  podium,
  suggestedKnowledgeExams: podium,
});

function renderHistory() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <HistoryPage me={ME} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HistoryPage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOutboxForTests();
  });

  it('lista los oficiales y los pendientes de la cola, del más reciente al más antiguo', async () => {
    fakeApi({
      'GET /api/v1/me/attempts': {
        status: 200,
        body: {
          items: [
            official(2, '2026-10-21T18:00:00.000Z', ['DC', 'EXT', 'MP']),
            official(1, '2026-10-20T18:00:00.000Z', ['DFC', 'MCD', 'LAT']),
          ],
        },
      },
    });
    await enqueue({
      id: uuid(400),
      kind: 'orientation-attempt',
      userId: ME.user.id,
      payload: { teamId: TEAM_ID, submittedAt: '2026-10-21T20:00:00.000Z' },
    });
    renderHistory();

    const items = within(await screen.findByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Pendiente: se envía cuando tengas señal y abras la app.');
    expect(items[1]).toHaveTextContent('Delantero centro');
    expect(items[1]).toHaveTextContent('Extremo y Mediapunta');
    expect(within(items[2]!).getByRole('link')).toHaveAttribute('href', `/resultados/${uuid(201)}`);
  });

  it('sin tests invita a hacer el primero', async () => {
    fakeApi({ 'GET /api/v1/me/attempts': { status: 200, body: { items: [] } } });
    renderHistory();
    expect(
      await screen.findByText('Todavía no has hecho el test de posición.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer mi test' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_ID}/test`,
    );
  });
});
