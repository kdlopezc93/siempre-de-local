import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchCurrentUser, signOutEverywhere, startGoogleSignIn } from './auth';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const USER = { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70', name: 'Kevin', email: 'k@example.com' };

describe('cliente de identidad', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve el usuario de la sesión enviando la cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { user: USER }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentUser()).resolves.toEqual(USER);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://api.sdl.test/api/v1/me');
    expect(init.credentials).toBe('include');
  });

  it('sin sesión (401) devuelve null en vez de fallar', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'x' } })),
    );
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it('otros errores del API se propagan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(500, { error: { code: 'INTERNAL', message: 'x' } })),
    );
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 500, code: 'INTERNAL' });
  });

  it('pide a Better Auth el login con Google con callbacks a la PWA', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { url: 'https://accounts.google.com/o/oauth2/auth?x' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(startGoogleSignIn()).resolves.toMatch(/^https:\/\/accounts\.google\.com/);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/auth/sign-in/social');
    expect(JSON.parse(init.body as string)).toEqual({
      provider: 'google',
      callbackURL: `${window.location.origin}/`,
      errorCallbackURL: `${window.location.origin}/entrar?error=google`,
    });
  });

  it('cerrar en todos los dispositivos revoca las sesiones y limpia la cookie', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal('fetch', fetchMock);

    await signOutEverywhere();
    const paths = fetchMock.mock.calls.map(([url]) => (url as URL).pathname);
    expect(paths).toEqual(['/api/auth/revoke-sessions', '/api/auth/sign-out']);
  });
});
