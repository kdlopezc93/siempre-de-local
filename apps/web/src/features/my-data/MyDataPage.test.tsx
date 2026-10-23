import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MyDataPage } from './MyDataPage';

describe('/tus-datos (pública)', () => {
  it('sin sesión: qué guardamos, cómo eliminar y la política', () => {
    render(
      <MemoryRouter initialEntries={['/tus-datos']}>
        <MyDataPage signedIn={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Tus datos' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cómo eliminar tu cuenta' })).toHaveTextContent(
      'escribe ELIMINAR',
    );
    expect(screen.getByText('Leer la política de tratamiento de datos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('después de eliminar la cuenta, lo confirma', () => {
    render(
      <MemoryRouter initialEntries={['/tus-datos?cuenta=eliminada']}>
        <MyDataPage signedIn={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu cuenta y tus datos fueron eliminados.',
    );
  });
});
