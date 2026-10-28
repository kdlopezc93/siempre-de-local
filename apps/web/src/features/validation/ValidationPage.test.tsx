import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { ValidationPage } from './ValidationPage';

const TEAM_ID = uuid(9);
const url = `GET /api/v1/teams/${TEAM_ID}/validation`;

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ValidationPage teamId={TEAM_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('informe de validación', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('aciertos del test, dónde no coincide y conocimiento vs. tarjeta', async () => {
    fakeApi({
      [url]: {
        status: 200,
        body: {
          testVsStaff: {
            n: 4,
            exact: 1,
            inPodium: 3,
            confusion: [
              { staff: 'DFC', test: 'MCD', count: 2 },
              { staff: 'DFC', test: 'DFC', count: 1 },
            ],
          },
          knowledgeVsCard: [
            {
              position: 'DFC',
              points: [0.3, 0.5, 0.6, 0.8, 0.9].map((pct, i) => ({ pct, mp: 50 + i * 8 })),
              rho: 1,
            },
            { position: 'MC', points: [{ pct: 0.5, mp: 70 }], rho: null },
          ],
        },
      },
    });
    renderPage();

    expect(await screen.findByText('25 %')).toBeInTheDocument();
    expect(screen.getByText('3 de 4')).toBeInTheDocument();
    expect(screen.getByText(/todavía es temprano/)).toBeInTheDocument();
    expect(screen.getByText('Tú: Defensa central. Test: Pivote.')).toBeInTheDocument();
    expect(screen.getByText(/Relación fuerte \(ρ = 1,00\): quienes más saben/)).toBeInTheDocument();
    expect(screen.getByText(/Hacen falta al menos 5 jugadores/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Defensa central: conocimiento frente a tarjeta' }),
    ).toBeInTheDocument();
  });

  it('sin datos, explica qué hace falta', async () => {
    fakeApi({
      [url]: {
        status: 200,
        body: { testVsStaff: { n: 0, exact: 0, inPodium: 0, confusion: [] }, knowledgeVsCard: [] },
      },
    });
    renderPage();
    expect(
      await screen.findByText(/Valora a cada jugador antes de mirar su test/),
    ).toBeInTheDocument();
    expect(screen.getByText(/examen de conocimiento y tarjeta a la vez/)).toBeInTheDocument();
  });
});
