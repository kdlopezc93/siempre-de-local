import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Me } from '../../shared/api/auth';
import { fakeApi } from '../../test/fake-api';
import { DEFAULT_PROFILE } from '../../test/me-fixture';
import { uuid } from '../../test/questionnaire-fixture';
import { ProfilePage } from './ProfilePage';
import { togglePreference } from './use-profile';

const ME: Me = {
  user: { id: uuid(8), name: 'Kevin López', email: 'k@example.com' },
  profile: { ...DEFAULT_PROFILE, preferredPositions: ['MC'] },
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  teams: [],
  clubs: [],
};

function renderProfile() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <ProfilePage me={ME} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('togglePreference', () => {
  it('suma al final hasta 3 y al quitar corre las demás', () => {
    expect(togglePreference(['MC'], 'DC')).toEqual(['MC', 'DC']);
    expect(togglePreference(['MC', 'DC', 'EXT'], 'POR')).toEqual(['MC', 'DC', 'EXT']);
    expect(togglePreference(['MC', 'DC', 'EXT'], 'MC')).toEqual(['DC', 'EXT']);
  });
});

describe('ProfilePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('guarda nombre, pie, portero y posiciones en orden', async () => {
    const bodies: Record<string, unknown> = {};
    const profile = (init: RequestInit, key: string) => {
      bodies[key] = JSON.parse(init.body as string);
      return { status: 200, body: { profile: { ...DEFAULT_PROFILE } } };
    };
    fakeApi({
      'PATCH /api/v1/me/profile': (init) => profile(init, 'patch'),
      'PUT /api/v1/me/preferred-positions': (init) => profile(init, 'put'),
    });
    renderProfile();

    const name = screen.getByRole('textbox', { name: 'Cómo te dicen en la cancha' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Kevo');
    await userEvent.click(screen.getByRole('radio', { name: 'Izquierdo' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Juego o podría jugar de portero' }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Pivote/ }));
    await userEvent.click(screen.getByRole('button', { name: /Defensa central/ }));
    // Con 3 elegidas, el resto queda bloqueado.
    expect(screen.getByRole('button', { name: /Extremo/ })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
    expect(bodies).toEqual({
      patch: { displayName: 'Kevo', dominantFoot: 'left', playsGoalkeeper: true },
      put: { positions: ['MC', 'MCD', 'DFC'] },
    });
  });

  it('no deja guardar un nombre vacío y lleva el foco al campo', async () => {
    const { calls } = fakeApi({});
    renderProfile();
    const name = screen.getByRole('textbox', { name: 'Cómo te dicen en la cancha' });
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByText('Escribe al menos 2 letras.')).toBeInTheDocument();
    expect(name).toHaveFocus();
    expect(calls).toEqual([]);
  });
});
