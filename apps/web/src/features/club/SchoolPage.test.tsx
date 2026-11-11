import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { ME_SCHOOL, SCHOOL, schoolClub } from '../../test/school-fixture';
import { ClubPage } from './ClubPage';

function renderPage() {
  const router = createMemoryRouter(
    [{ path: '/c', element: <ClubPage me={ME_SCHOOL} clubId={SCHOOL} /> }],
    { initialEntries: ['/c'] },
  );
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

describe('la escuela (2026-11-07)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra las categorías por edad con sus grupos, la franja y las sedes', async () => {
    fakeApi({ [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() } });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Quiénes caben hoy' })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Sub-12, 2014–2015: masculino, femenino/ }),
    ).toBeVisible();
    expect(screen.getByRole('img', { name: /2009–2013 sin categoría/ })).toBeVisible();

    const sub12 = screen.getByRole('article', { name: 'Sub-12' });
    expect(within(sub12).getByText('2014–2015')).toBeInTheDocument();
    // Tu grupo se abre; el otro no.
    expect(within(sub12).getByRole('link', { name: /Masculino A/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/equipo`,
    );
    // Kevin está en los dos grupos de Sub-12 (en el femenino, en la ficha de prueba).
    expect(within(sub12).getAllByText('Tu grupo')).toHaveLength(2);
    expect(within(sub12).getByRole('link', { name: /Femenino/ })).toBeInTheDocument();
    expect(within(sub12).getByText('Fútbol 8 · El Tunal · 18 personas')).toBeInTheDocument();
    const mayores = screen.getByRole('article', { name: 'Mayores' });
    expect(within(mayores).getByText('2008 o antes')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Categorías 3 grupos de 30/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Nuevo grupo' })).toHaveAttribute(
      'href',
      `/clubes/${SCHOOL}/nuevo-equipo`,
    );
    expect(screen.getByText('Cancha 3 · 1 grupo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Datos de la escuela' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Admins de la escuela' })).toBeInTheDocument();
  });

  it('agrega una sede', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() },
      [`POST /api/v1/clubs/${SCHOOL}/venues`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: schoolClub() };
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sede' }));
    const sheet = await screen.findByRole('dialog', { name: 'Agregar sede' });
    await userEvent.type(within(sheet).getByLabelText('Nombre'), 'Timiza');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar sede' }));
    expect(body).toEqual({ name: 'Timiza', address: null });
  });

  it('cada vez que se agrega una sede, el formulario empieza vacío', async () => {
    fakeApi({
      [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() },
      [`POST /api/v1/clubs/${SCHOOL}/venues`]: { status: 201, body: schoolClub() },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sede' }));
    let sheet = await screen.findByRole('dialog', { name: 'Agregar sede' });
    await userEvent.type(within(sheet).getByLabelText('Nombre'), 'Timiza');
    await userEvent.type(within(sheet).getByLabelText(/Dirección/), 'Cancha sintética');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Guardar sede' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar sede' }));
    sheet = await screen.findByRole('dialog', { name: 'Agregar sede' });
    expect(within(sheet).getByLabelText('Nombre')).toHaveValue('');
    expect(within(sheet).getByLabelText(/Dirección/)).toHaveValue('');
  });

  it('borrar una sede pide confirmar y dice qué pasa con sus grupos', async () => {
    let deleted = false;
    fakeApi({
      [`GET /api/v1/clubs/${SCHOOL}`]: { status: 200, body: schoolClub() },
      [`DELETE /api/v1/clubs/${SCHOOL}/venues/${schoolClub().venues[0]!.id}`]: () => {
        deleted = true;
        return { status: 200, body: schoolClub({ venues: [] }) };
      },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Editar El Tunal' }));
    const sheet = await screen.findByRole('dialog', { name: 'Editar El Tunal' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Borrar sede' }));
    expect(within(sheet).getByText('Su grupo queda sin sede; no se borra nada más.')).toBeVisible();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Sí, borrar El Tunal' }));
    expect(deleted).toBe(true);
  });
});
