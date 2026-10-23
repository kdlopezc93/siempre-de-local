import 'fake-indexeddb/auto';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IDBFactory } from 'fake-indexeddb';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../../shared/api/auth';
import { resetOutboxForTests } from '../../shared/offline/outbox';
import { fakeApi } from '../../test/fake-api';
import { QUESTIONNAIRE, uuid } from '../../test/questionnaire-fixture';
import { QuizPage } from './QuizPage';
import { DEFAULT_PROFILE } from '../../test/me-fixture';

const TEAM_ID = uuid(9);
const me = (roles: ('player' | 'coach')[]): Me => ({
  user: { id: uuid(8), name: 'Kevin', email: 'k@example.com' },
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  teams: [
    {
      team: { id: TEAM_ID, name: 'Primer equipo', format: 'F11', formats: ['F11'], season: '2026' },
      club: { id: uuid(10), name: 'Los del Barrio' },
      roles,
      jerseyNumber: null,
    },
  ],
  profile: DEFAULT_PROFILE,
  clubs: [],
});

function renderQuiz(roles: ('player' | 'coach')[] = ['player']) {
  const router = createMemoryRouter(
    [
      { path: '/test', element: <QuizPage me={me(roles)} teamId={TEAM_ID} /> },
      { path: '/', element: <p>Inicio</p> },
    ],
    { initialEntries: ['/', '/test'], initialIndex: 1 },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

/** Responde las 20 preguntas con la primera opción visible. */
async function answerAll() {
  for (let i = 0; i < 20; i++) {
    await screen.findByText(`${i + 1} de 20`);
    const [first] = screen.getAllByRole('button', { pressed: false });
    await userEvent.click(first!);
  }
}

describe('QuizPage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    // Sin la pausa de 220 ms entre preguntas.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await resetOutboxForTests();
  });

  it('del inicio al podio oficial: 20 preguntas y envío por la cola', async () => {
    const submitted: unknown[] = [];
    fakeApi({
      'GET /api/v1/questionnaires/current': { status: 200, body: QUESTIONNAIRE },
      'POST /api/v1/attempts': (init) => {
        const body = JSON.parse(init.body as string);
        submitted.push(body);
        return {
          status: 201,
          body: {
            attemptId: uuid(77),
            clientAttemptId: body.clientAttemptId,
            teamId: TEAM_ID,
            format: 'F11',
            submittedAt: body.submittedAt,
            winner: 'DFC',
            ranking: [
              { pos: 'DFC', pct: 0.8 },
              { pos: 'MCD', pct: 0.7 },
              { pos: 'LAT', pct: 0.6 },
            ],
            podium: ['DFC', 'MCD', 'LAT'],
            suggestedKnowledgeExams: ['DFC', 'MCD', 'LAT'],
          },
        };
      },
    });
    renderQuiz();

    expect(
      await screen.findByRole('heading', { name: '¿Dónde deberías jugar?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Primer equipo, fútbol 11')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Empezar' }));

    expect(await screen.findByText('1 de 20')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();

    await answerAll();
    expect(await screen.findByText('Tus 3 posiciones')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Defensa central' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent(/Pivote.*Lateral/);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      teamId: TEAM_ID,
      format: 'F11',
      questionnaireVersionId: QUESTIONNAIRE.versionId,
    });
  });

  it('sin red muestra el podio provisional y avisa que se envía después', async () => {
    const { fetchMock } = fakeApi({
      'GET /api/v1/questionnaires/current': { status: 200, body: QUESTIONNAIRE },
    });
    fetchMock.mockImplementation((input: URL | string) =>
      String(input).includes('/attempts')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(new Response(JSON.stringify(QUESTIONNAIRE), { status: 200 })),
    );
    renderQuiz();

    await userEvent.click(await screen.findByRole('button', { name: 'Empezar' }));
    await answerAll();
    expect(await screen.findByText('Tu podio provisional')).toBeInTheDocument();
    // Primero "calculando"; al fallar el envío sin red, pasa a "guardado".
    expect(await screen.findByText(/Tu test quedó guardado/)).toHaveAttribute('role', 'status');
  });

  it('salir a mitad del test pide confirmación', async () => {
    fakeApi({ 'GET /api/v1/questionnaires/current': { status: 200, body: QUESTIONNAIRE } });
    const router = renderQuiz();

    await userEvent.click(await screen.findByRole('button', { name: 'Empezar' }));
    await screen.findByText('1 de 20');
    await router.navigate(-1);
    expect(await screen.findByRole('heading', { name: '¿Dejar el test?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Seguir con el test' }));
    expect(await screen.findByText('1 de 20')).toBeInTheDocument();
  });

  it('el entrenador que no es jugador no hace el test', () => {
    fakeApi({});
    renderQuiz(['coach']);
    expect(
      screen.getByText('Solo los jugadores del equipo hacen el test en él.'),
    ).toBeInTheDocument();
  });
});
