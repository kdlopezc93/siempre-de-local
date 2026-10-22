import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { TeamDataPage } from './TeamDataPage';

const TEAM_ID = uuid(9);
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Primer equipo',
    format: 'F11',
    season: '2026',
    club: { id: uuid(10), name: 'Los del Barrio' },
    ratingsVisibleToPlayers: true,
  },
  myRoles: ['coach'],
};
const CSV = '"Nombre","Posicion"\n"Ana","Mediocentro"';

function renderPage() {
  const router = createMemoryRouter([{ path: '/d', element: <TeamDataPage teamId={TEAM_ID} /> }], {
    initialEntries: ['/d'],
  });
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

describe('TeamDataPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('descarga el CSV con el nombre que propone el API', async () => {
    const { fetchMock } = fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/legacy-results`]: { status: 200, body: { items: [] } },
    });
    fetchMock.mockImplementation((input: URL | string) =>
      Promise.resolve(
        String(input).endsWith('/export.csv')
          ? new Response('"Nombre"\r\n', {
              headers: {
                'content-type': 'text/csv',
                'content-disposition': 'attachment; filename="plantilla-primer-equipo.csv"',
              },
            })
          : new Response(JSON.stringify(String(input).endsWith(TEAM_ID) ? TEAM : { items: [] })),
      ),
    );
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar CSV' }));
    await vi.waitFor(() => expect(clicked).toEqual(['plantilla-primer-equipo.csv']));
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('importa archivos y lo pegado, y muestra el resumen con las filas rechazadas', async () => {
    let sent = '';
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/legacy-results`]: { status: 200, body: { items: [] } },
      [`POST /api/v1/teams/${TEAM_ID}/legacy-import`]: (init) => {
        sent = (JSON.parse(init.body as string) as { csv: string }).csv;
        return {
          status: 200,
          body: {
            imported: 2,
            duplicates: 1,
            linked: 1,
            rejected: [{ line: 4, reason: 'Posición desconocida: "Volante"' }],
          },
        };
      },
    });
    renderPage();

    const importButton = await screen.findByRole('button', { name: 'Importar' });
    await userEvent.click(importButton);
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un archivo o pega el contenido');
    await userEvent.upload(
      screen.getByLabelText(/Elegir los archivos CSV/),
      new File([CSV], 'ana.csv', { type: 'text/csv' }),
    );
    expect(screen.getByText('1 archivo elegido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Pega el contenido/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Contenido de los CSV' }), 'pegado');
    await userEvent.click(importButton);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      'Guardamos 2 resultados. 1 quedó ligado a jugadores del equipo por su nombre. 1 ya estaba.',
    );
    expect(status).toHaveTextContent('Línea 4: Posición desconocida: "Volante"');
    expect(sent).toBe(`${CSV}\npegado`);
  });

  it('lista lo importado, ligado o no', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/legacy-results`]: {
        status: 200,
        body: {
          items: [
            {
              id: uuid(40),
              playerName: 'ana',
              player: { userId: uuid(21), displayName: 'Ana' },
              takenAt: '2026-05-10T14:32',
              format: 'F11',
              winner: 'MC',
              affinityPct: 88,
              podium: ['MC', 'MCD', 'MP'],
              prepScore: 7,
              prepTotal: 8,
              importedAt: '2026-10-22T10:00:00.000Z',
            },
            {
              id: uuid(41),
              playerName: 'Carlos Viejo',
              player: null,
              takenAt: null,
              format: 'F11',
              winner: 'LAT',
              affinityPct: null,
              podium: ['LAT'],
              prepScore: null,
              prepTotal: null,
              importedAt: '2026-10-22T10:00:00.000Z',
            },
          ],
        },
      },
    });
    renderPage();

    const list = await screen.findByRole('region', { name: 'Del prototipo (2)' });
    expect(list).toHaveTextContent(
      /AnaMediocentro.*Mediocentro, Pivote, Mediapunta\. preparación 7\/8/,
    );
    expect(list).toHaveTextContent('Carlos ViejoLateralsin ligar a un jugador');
  });
});
