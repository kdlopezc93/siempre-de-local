import { vi } from 'vitest';

type Handler = (init: RequestInit) => { status: number; body?: unknown };

/** `fetch` falso que responde por "MÉTODO /ruta" y registra las llamadas en orden. */
export function fakeApi(routes: Record<string, Handler | { status: number; body?: unknown }>) {
  const calls: string[] = [];
  const fetchMock = vi.fn((input: URL | string, init: RequestInit = {}) => {
    const key = `${init.method ?? 'GET'} ${new URL(input).pathname}`;
    calls.push(key);
    const route = routes[key];
    const { status, body } = typeof route === 'function' ? route(init) : (route ?? { status: 404 });
    return Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
