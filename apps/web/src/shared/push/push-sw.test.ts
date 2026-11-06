// @vitest-environment node
import { readFileSync } from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

/** Carga public/push-sw.js con un `self` falso y devuelve sus manejadores. */
function loadWorker(windows: { postMessage: (m: unknown) => void }[] = []) {
  const listeners = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn),
    registration: { showNotification },
    location: { origin: 'https://app.sdl.test' },
    SDL_API_URL: 'https://api.sdl.test',
    clients: { matchAll: vi.fn(async () => windows), openWindow },
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

/** El título y las opciones del último aviso mostrado. */
const last = (show: ReturnType<typeof vi.fn>) =>
  show.mock.calls.at(-1) as unknown as [
    string,
    { actions?: { action: string; title: string }[]; data: object },
  ];
const lastOptions = (show: ReturnType<typeof vi.fn>) => last(show)[1];

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

  it('la convocatoria a entrenar no habla de rival (2026-10-28)', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'training-called',
        opponent: 'Entrenamiento',
        startsAt: '2026-11-01T15:00:00.000Z',
        url: '/equipos/t/partidos/m',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Te convocaron a entrenar',
      expect.objectContaining({ body: expect.stringMatching(/¿Vas\?$/) }),
    );
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

  it('el recordatorio del test lleva al test', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'test-reminder',
        team: 'QLeones FC',
        opponent: 'QLeones FC',
        url: '/equipos/t/test',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      '¿Ya hiciste tu test de posición?',
      expect.objectContaining({
        body: 'Tu cuerpo técnico de QLeones FC te lo recuerda. Son unos minutos.',
        data: { url: '/equipos/t/test' },
      }),
    );
  });

  it('un cobro nuevo: de qué es, sin el valor, y lleva a tus cuentas (2026-10-30)', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'charge-created',
        charge: 'Vaca',
        opponent: 'Vaca',
        url: '/equipos/t/mis-cuentas',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Nuevo cobro del equipo: Vaca',
      expect.objectContaining({
        body: 'Toca para ver cuánto te toca y avisar cuando pagues.',
        data: { url: '/equipos/t/mis-cuentas' },
      }),
    );
  });

  it('patrocinios: a quien le cubrieron la parte y a quien la asumió, sin quién ni el valor', async () => {
    const { fire, showNotification } = loadWorker();
    const base = { charge: 'Arbitraje', opponent: 'Arbitraje', url: '/equipos/t/mis-cuentas' };
    await fire('push', push({ ...base, kind: 'charge-covered' }));
    await fire('push', push({ ...base, kind: 'charge-sponsor' }));
    expect(showNotification).toHaveBeenCalledWith(
      'Te cubrieron tu parte: Arbitraje',
      expect.objectContaining({ body: 'Ya no debes nada de este cobro.' }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Asumiste la parte de un compañero: Arbitraje',
      expect.objectContaining({ body: 'Toca para ver cuánto es y avisar cuando pagues.' }),
    );
  });

  it('recordar los cobros: del equipo, sin el valor (2026-10-31)', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'charges-reminder',
        team: 'QLeones FC',
        opponent: 'QLeones FC',
        url: '/equipos/t/mis-cuentas',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Tienes cobros pendientes en QLeones FC',
      expect.objectContaining({
        body: 'Toca para ver cuánto y avisar cuando pagues.',
        data: { url: '/equipos/t/mis-cuentas' },
      }),
    );
  });

  it('el recordatorio por fecha: mañana u hoy vence, sin el valor (2026-10-31)', async () => {
    const { fire, showNotification } = loadWorker();
    const base = { charge: 'Cuota', opponent: 'Cuota', url: '/equipos/t/mis-cuentas' };
    await fire('push', push({ ...base, kind: 'charge-due', when: 'tomorrow' }));
    await fire('push', push({ ...base, kind: 'charge-due', when: 'today' }));
    expect(showNotification).toHaveBeenCalledWith(
      'Mañana vence: Cuota',
      expect.objectContaining({
        body: 'Todavía debes tu parte. Toca para ver cuánto y avisar cuando pagues.',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith('Hoy vence: Cuota', expect.anything());
  });

  it('un tipo que no conoce lleva un texto neutro, nunca el de otro aviso', async () => {
    const { fire, showNotification } = loadWorker();
    await fire(
      'push',
      push({
        kind: 'algo-nuevo',
        opponent: 'Los Pibes',
        startsAt: '2026-11-01T15:00:00.000Z',
        url: '/equipos/t/partidos/m',
      }),
    );
    expect(showNotification).toHaveBeenCalledWith(
      'Novedades del partido: Los Pibes',
      expect.objectContaining({ body: 'Toca para verlas.' }),
    );
    await fire('push', push({ kind: 'algo-nuevo', url: '/equipos/t' }));
    expect(showNotification).toHaveBeenLastCalledWith(
      'Novedades de tu equipo',
      expect.objectContaining({ body: 'Toca para verlas.' }),
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

  describe('"Voy / No voy" desde el aviso (2026-11-06)', () => {
    afterEach(() => vi.unstubAllGlobals());
    const CALLED = {
      kind: 'match-called',
      opponent: 'Los Pibes',
      startsAt: '2026-11-01T15:00:00.000Z',
      url: '/equipos/t1/partidos/m1',
    };
    const click = (action: string, data: object) => ({
      action,
      notification: { close: vi.fn(), data },
    });

    it('la convocatoria trae los dos botones; la alineación no', async () => {
      const { fire, showNotification } = loadWorker();
      await fire('push', push(CALLED));
      expect(lastOptions(showNotification).actions).toEqual([
        { action: 'yes', title: 'Voy' },
        { action: 'no', title: 'No voy' },
      ]);
      await fire('push', push({ ...CALLED, kind: 'lineup-published' }));
      expect(lastOptions(showNotification).actions).toBeUndefined();
    });

    it('"Voy" responde en el API con la sesión, sin abrir la app, y avisa que quedó', async () => {
      const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', fetch);
      const postMessage = vi.fn();
      const { fire, showNotification, openWindow } = loadWorker([{ postMessage }]);
      await fire('push', push(CALLED));
      await fire('notificationclick', click('yes', lastOptions(showNotification).data));

      const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
      expect(url.href).toBe('https://api.sdl.test/api/v1/teams/t1/matches/m1/reply');
      expect(init).toMatchObject({ method: 'PUT', credentials: 'include' });
      expect(JSON.parse(init.body as string)).toEqual({ reply: 'yes' });
      expect(openWindow).not.toHaveBeenCalled();
      expect(last(showNotification)[0]).toBe('Listo, vas contra Los Pibes');
      expect(postMessage).toHaveBeenCalledWith({
        type: 'sdl:match-replied',
        teamId: 't1',
        matchId: 'm1',
      });
    });

    it('el entreno: "Listo, no vas al entreno"', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 200 })),
      );
      const { fire, showNotification } = loadWorker();
      await fire('push', push({ ...CALLED, kind: 'training-called', opponent: undefined }));
      await fire('notificationclick', click('no', lastOptions(showNotification).data));
      expect(last(showNotification)[0]).toBe('Listo, no vas al entreno');
    });

    it('sin sesión o sin señal, abre el partido para responder ahí', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('{}', { status: 401 })),
      );
      const { fire, showNotification, openWindow } = loadWorker();
      await fire('push', push(CALLED));
      await fire('notificationclick', click('yes', lastOptions(showNotification).data));
      expect(openWindow).toHaveBeenCalledWith('https://app.sdl.test/equipos/t1/partidos/m1');

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Promise.reject(new TypeError('offline'))),
      );
      await fire('notificationclick', click('no', lastOptions(showNotification).data));
      expect(openWindow).toHaveBeenCalledTimes(2);
    });

    it('tocar el aviso (sin botón) abre el partido, como siempre', async () => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const { fire, showNotification, openWindow } = loadWorker();
      await fire('push', push(CALLED));
      await fire('notificationclick', click('', lastOptions(showNotification).data));
      expect(fetch).not.toHaveBeenCalled();
      expect(openWindow).toHaveBeenCalledWith('https://app.sdl.test/equipos/t1/partidos/m1');
    });
  });
});
