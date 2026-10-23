import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useUnsavedChanges } from './UnsavedChanges';

function Form() {
  const [text, setText] = useState('');
  const guard = useUnsavedChanges(text !== '');
  const navigate = useNavigate();
  return (
    <>
      {guard.prompt}
      <label>
        Nombre
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Link to="/otra">Irse</Link>
      <Link to="?ver=b">Otra pestaña</Link>
      <button
        type="button"
        onClick={() => {
          guard.release();
          void navigate('/otra');
        }}
      >
        Guardar
      </button>
    </>
  );
}

function renderForm() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Form /> },
      { path: '/otra', element: <p>otra pantalla</p> },
    ],
    { initialEntries: ['/'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('aviso de cambios sin guardar', () => {
  it('sin cambios, se sale sin preguntar', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('link', { name: 'Irse' }));
    expect(await screen.findByText('otra pantalla')).toBeInTheDocument();
  });

  it('con cambios pregunta: seguir aquí los conserva; salir los descarta', async () => {
    const router = renderForm();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.click(screen.getByRole('link', { name: 'Irse' }));
    expect(await screen.findByText('Lo que cambiaste en esta pantalla se pierde.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Seguir aquí' }));
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Ana');

    await userEvent.click(screen.getByRole('link', { name: 'Irse' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));
    expect(await screen.findByText('otra pantalla')).toBeInTheDocument();
  });

  it('cambiar de pestaña (solo la URL) no pregunta, y tras guardar tampoco', async () => {
    const router = renderForm();
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    await userEvent.click(screen.getByRole('link', { name: 'Otra pestaña' }));
    expect(router.state.location.search).toBe('?ver=b');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('otra pantalla')).toBeInTheDocument();
  });

  it('al cerrar o recargar la pestaña con cambios, pide confirmar al navegador', async () => {
    renderForm();
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      act(() => void window.dispatchEvent(event));
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
    expect(unload()).toBe(true);
  });
});
