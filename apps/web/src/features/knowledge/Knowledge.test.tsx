import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../../shared/api/auth';
import { fakeApi } from '../../test/fake-api';
import { DEFAULT_PROFILE } from '../../test/me-fixture';
import { uuid } from '../../test/questionnaire-fixture';
import { ExamPage } from './ExamPage';
import { KnowledgePage } from './KnowledgePage';

const TEAM_ID = uuid(9);
const EXAM_ID = uuid(50);
const me: Me = {
  user: { id: uuid(8), name: 'Ana', email: 'ana@example.com' },
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  teams: [
    {
      team: {
        id: TEAM_ID,
        name: 'Primer equipo',
        format: 'F11',
        formats: ['F11'],
        season: '2026',
        photoUrl: null,
      },
      club: { id: uuid(10), name: 'Los del Barrio' },
      roles: ['player'],
    },
  ],
  profile: DEFAULT_PROFILE,
  clubs: [],
};
const AREAS = [
  { code: 'marcaje', name: 'Marcaje' },
  { code: 'aereo', name: 'Juego aéreo' },
];
const bank = {
  label: 'v1',
  itemsPerExam: 2,
  timeLimitSeconds: 1200,
  attemptIntervalDays: 30,
  areas: AREAS,
};
const position = (over: object = {}) => ({
  position: 'DFC',
  bank,
  best: null,
  review: null,
  nextAttemptAt: null,
  activeExamId: null,
  ...over,
});
const item = (n: number, answer: string | null = null) => ({
  id: uuid(60 + n),
  area: AREAS[n % 2]!,
  text: `Pregunta ${n + 1}`,
  options: [0, 1, 2, 3].map((o) => ({ id: uuid(100 + n * 4 + o), label: `Opción ${o + 1}` })),
  answerOptionId: answer,
});
const inProgress = (over: object = {}) => ({
  state: 'in_progress',
  examId: EXAM_ID,
  position: 'DFC',
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  deadlineAt: new Date(Date.now() + 19 * 60_000).toISOString(),
  serverNow: new Date().toISOString(),
  items: [item(0), item(1)],
  ...over,
});
const finished = {
  state: 'finished',
  examId: EXAM_ID,
  position: 'DFC',
  endedBy: 'submit',
  startedAt: '2026-10-22T10:00:00.000Z',
  submittedAt: '2026-10-22T10:12:00.000Z',
  score: 1,
  total: 2,
  pct: 0.5,
  band: 'developing',
  byArea: [
    { area: AREAS[0], correct: 1, total: 1 },
    { area: AREAS[1], correct: 0, total: 1 },
  ],
  nextAttemptAt: '2026-11-21T10:00:00.000Z',
  voided: null,
  superseded: false,
  fromReview: false,
};

function renderRoutes(path: string) {
  const routes: { path: string; element: ReactNode }[] = [
    { path: '/conocimiento', element: <KnowledgePage me={me} /> },
    { path: '/conocimiento/examen/:examId', element: <ExamPage examId={EXAM_ID} /> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

describe('examen de conocimiento', () => {
  beforeEach(() => {
    // Sin la pausa entre preguntas.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('la lista explica qué mide y pide confirmar antes de que arranque el reloj', async () => {
    let started: unknown;
    fakeApi({
      'GET /api/v1/certification/positions': { status: 200, body: { positions: [position()] } },
      'GET /api/v1/me/cert-exams': { status: 200, body: { items: [] } },
      'POST /api/v1/cert-exams': (init) => {
        started = JSON.parse(init.body as string);
        return { status: 201, body: inProgress() };
      },
      [`GET /api/v1/cert-exams/${EXAM_ID}`]: { status: 200, body: inProgress() },
    });
    const router = renderRoutes('/conocimiento');

    const card = await screen.findByRole('article', { name: 'Defensa central' });
    expect(card).toHaveTextContent('2 preguntas en 20 minutos. Áreas: marcaje, juego aéreo.');
    expect(screen.getByText(/no si lo haces en la cancha/)).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Presentar el examen' }));
    expect(card).toHaveTextContent('El reloj de 20 minutos arranca apenas empieces');
    await userEvent.click(within(card).getByRole('button', { name: 'Empezar ahora' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/conocimiento/examen/${EXAM_ID}`),
    );
    expect(started).toEqual({ position: 'DFC', teamId: TEAM_ID });
  });

  it('muestra el mejor puntaje, la espera del mes y el examen a medias', async () => {
    fakeApi({
      'GET /api/v1/certification/positions': {
        status: 200,
        body: {
          positions: [
            position({
              best: { examId: uuid(51), pct: 0.75, band: 'solid', underReview: false },
              nextAttemptAt: '2026-11-21T10:00:00.000Z',
              activeExamId: EXAM_ID,
            }),
          ],
        },
      },
      'GET /api/v1/me/cert-exams': { status: 200, body: { items: [finished] } },
    });
    renderRoutes('/conocimiento');

    const card = await screen.findByRole('article', { name: 'Defensa central' });
    expect(card).toHaveTextContent('Tu mejor puntaje: 75%, Sólido');
    expect(card).toHaveTextContent('Puedes volver a presentarlo desde el 21 nov');
    expect(screen.getByRole('link', { name: 'Seguir con tu examen' })).toHaveAttribute(
      'href',
      `/conocimiento/examen/${EXAM_ID}`,
    );
    expect(
      await screen.findByRole('link', { name: /Defensa central.*50% En desarrollo/ }),
    ).toBeInTheDocument();
  });

  it('el jugador ve la re-evaluación con su motivo y sus exámenes anulados', async () => {
    fakeApi({
      'GET /api/v1/certification/positions': {
        status: 200,
        body: {
          positions: [
            position({
              best: { examId: uuid(51), pct: 0.9, band: 'mastery', underReview: false },
              review: {
                id: uuid(80),
                position: 'DFC',
                reason: 'En la cancha no aplica lo que sabe',
                requestedAt: '2026-10-20T10:00:00.000Z',
                dueAt: '2026-11-03T10:00:00.000Z',
                status: 'pending',
                requestedBy: null,
                resolvedExamId: null,
              },
            }),
          ],
        },
      },
      'GET /api/v1/me/cert-exams': {
        status: 200,
        body: {
          items: [
            { ...finished, voided: { reason: 'Lo hizo otra persona', at: finished.submittedAt } },
          ],
        },
      },
    });
    renderRoutes('/conocimiento');

    const card = await screen.findByRole('article', { name: 'Defensa central' });
    expect(card).toHaveTextContent('Tu entrenador te pidió volver a presentarlo antes del 3 nov');
    expect(card).toHaveTextContent('“En la cancha no aplica lo que sabe”');
    expect(card).toHaveTextContent('reemplaza al anterior, aunque sea más bajo');
    expect(within(card).getByRole('button', { name: 'Presentar la re-evaluación' })).toBeEnabled();
    expect(
      await screen.findByRole('link', { name: /Defensa central.*Anulado/ }),
    ).toBeInTheDocument();
  });

  it('responder guarda cada respuesta y avanza; la revisión deja entregar y muestra el resultado', async () => {
    const answers: unknown[] = [];
    fakeApi({
      [`GET /api/v1/cert-exams/${EXAM_ID}`]: { status: 200, body: inProgress() },
      [`PUT /api/v1/cert-exams/${EXAM_ID}/answers/${uuid(60)}`]: (init) => {
        answers.push(JSON.parse(init.body as string));
        return { status: 204 };
      },
      [`POST /api/v1/cert-exams/${EXAM_ID}/submit`]: { status: 200, body: finished },
    });
    renderRoutes(`/conocimiento/examen/${EXAM_ID}`);

    expect(await screen.findByRole('timer')).toHaveTextContent(/^1[89]:\d\d$/);
    expect(screen.getByRole('heading', { name: 'Pregunta 1' })).toHaveFocus();
    expect(screen.getByText('1 de 2, marcaje')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Opción 2' }));
    expect(answers).toEqual([{ optionId: uuid(101) }]);
    expect(await screen.findByRole('heading', { name: 'Pregunta 2' })).toBeInTheDocument();

    // Se la salta: en la revisión queda pendiente.
    await userEvent.click(screen.getByRole('button', { name: 'Revisar' }));
    expect(await screen.findByRole('heading', { name: 'Te falta 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pregunta 1, respondida' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pregunta 2, sin responder' })).toBeInTheDocument();
    expect(screen.getByText('Las que dejes sin responder cuentan como fallo.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entregar el examen' }));
    expect(await screen.findByRole('heading', { name: '50%' })).toBeInTheDocument();
    expect(screen.getByText('En desarrollo')).toBeInTheDocument();
    const areas = screen.getByRole('region', { name: 'Por área' });
    expect(areas).toHaveTextContent('Marcaje1/1');
    expect(areas).toHaveTextContent('Juego aéreo0/1');
    expect(screen.getByText(/desde el 21 de noviembre/)).toBeInTheDocument();
  });

  it('al acabarse el tiempo pide el examen de nuevo y muestra el cierre', async () => {
    const { fetchMock } = fakeApi({});
    let calls = 0;
    fetchMock.mockImplementation(() => {
      calls++;
      const body =
        calls === 1
          ? inProgress({ deadlineAt: new Date(Date.now() - 1000).toISOString() })
          : { ...finished, endedBy: 'timeout' };
      return Promise.resolve(
        new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }),
      );
    });
    renderRoutes(`/conocimiento/examen/${EXAM_ID}`);

    expect(
      await screen.findByText(
        /Se acabó el tiempo: contamos lo que respondiste/,
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('abandonar pide confirmación', async () => {
    let abandoned = false;
    fakeApi({
      [`GET /api/v1/cert-exams/${EXAM_ID}`]: {
        status: 200,
        body: inProgress({ items: [item(0, uuid(100)), item(1, uuid(104))] }),
      },
      [`POST /api/v1/cert-exams/${EXAM_ID}/abandon`]: () => {
        abandoned = true;
        return { status: 200, body: { ...finished, endedBy: 'abandon' } };
      },
    });
    renderRoutes(`/conocimiento/examen/${EXAM_ID}`);

    // Todo respondido: arranca en la revisión.
    expect(await screen.findByRole('heading', { name: 'Respondiste todas' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abandonar' }));
    expect(abandoned).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, abandonar' }));
    expect(await screen.findByText(/Lo abandonaste/)).toBeInTheDocument();
  });
});
