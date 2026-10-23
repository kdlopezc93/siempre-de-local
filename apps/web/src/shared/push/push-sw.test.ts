// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

/** Carga public/push-sw.js con un `self` falso y devuelve sus manejadores. */
function loadWorker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    registration: { showNotification },
    location: { origin: 'https://app.sdl.test' },
    clients: { matchAll: vi.fn(async () => []), openWindow },
  };
  const source = readFileSync(new URL('../../../public/push-sw.js', import.meta.url), 'utf8');
  new Function('self', source)(self);
  const fire = async (type: string, event: object) => {
    let wait: Promise<unknown> = Promise.resolve();
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
  };
  return { fire, showNotification, openWindow };
}

const push = (data: unknown) => ({ data: { json: () => data } });

describe('avisos en el service worker', () => {
  it('convocatoria y alineación: el texto se arma en el celular', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'match-called',
        opponent: 'Los Pibes',
        startsAt: '2026-11-01T15:00:00.000Z',
        url: '/equipos/t/partidos/m',
      }),
    );
    await fire(
      'push',
      push({
        kind: 'lineup-published',
        opponent: 'Los Pibes',
        startsAt: '2026-11-01T15:00:00.000Z',
        url: '/equipos/t/partidos/m',
      }),
    );
    const calls = showNotification.mock.calls as unknown as [
      string,
      { body: string; data: { url: string } },
    ][];
    expect(calls.map(([title]) => title)).toEqual([
      'Te convocaron: Los Pibes',
      'Ya está la alineación: Los Pibes',
    ]);
    expect(calls[0]![1].body).toMatch(/¿Vas\?$/);
    expect(calls[0]![1].data.url).toBe('/equipos/t/partidos/m');
  });

  it('la figura del partido: la felicitación (D18)', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'match-figure',
        opponent: 'Los Pibes',
        startsAt: '2026-11-01T15:00:00.000Z',
        url: '/equipos/t/partidos/m',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      '¡Fuiste la figura contra Los Pibes!',
      expect.objectContaining({ body: 'Felicitaciones de tu cuerpo técnico.' }),
    );
  });

  it('ignora avisos que quieren llevar a otro sitio o que vienen rotos', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({ kind: 'match-called', opponent: 'X', startsAt: null, url: 'https://evil.example/' }),
    );
    await fire('push', {
      data: {
        json: () => {
          throw new Error('roto');
        },
      },
    });
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('tocar el aviso abre el partido', async () => {
    const { fire, openWindow } = loadWorker();
    await fire('notificationclick', {
      notification: { close: () => {}, data: { url: '/equipos/t/partidos/m' } },
    });
    expect(openWindow).toHaveBeenCalledWith('https://app.sdl.test/equipos/t/partidos/m');
  });
});
