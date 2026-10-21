import 'fake-indexeddb/auto';

import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';
import { clearSent, enqueue, flushOutbox, outboxStore, resetOutboxForTests } from './outbox';

const OFFLINE = new TypeError('Failed to fetch');

/** Cada operación de la cola refresca la instantánea que ve React. */
const items = () => outboxStore.getSnapshot().items;

function add(id: string, userId = 'u1') {
  return enqueue({ id, kind: 'attempt', userId, payload: { id } });
}

describe('cola offline', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(async () => {
    await resetOutboxForTests();
  });

  it('envía en orden y guarda la respuesta del servidor', async () => {
    await add('a');
    await add('b');
    const send = vi.fn((payload: unknown) => Promise.resolve({ ok: payload }));

    await expect(flushOutbox('u1', { attempt: send })).resolves.toBe('done');
    expect(send.mock.calls.map(([p]) => p)).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(items().map((i) => [i.id, i.status, i.result])).toEqual([
      ['a', 'sent', { ok: { id: 'a' } }],
      ['b', 'sent', { ok: { id: 'b' } }],
    ]);
  });

  it('sin red se detiene y deja todo pendiente para reintentar', async () => {
    await add('a');
    await add('b');
    const send = vi.fn().mockRejectedValue(OFFLINE);

    await expect(flushOutbox('u1', { attempt: send })).resolves.toBe('offline');
    expect(outboxStore.getSnapshot().lastOutcome).toBe('offline');
    expect(send).toHaveBeenCalledTimes(1);
    const [a, b] = items();
    expect(a).toMatchObject({ status: 'pending', tries: 1, lastError: 'Failed to fetch' });
    expect(b).toMatchObject({ status: 'pending', tries: 0 });
  });

  it('un 4xx definitivo marca el ítem como rechazado y sigue con el resto', async () => {
    await add('a');
    await add('b');
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(422, 'BUSINESS_RULE', 'x'))
      .mockResolvedValueOnce({});

    await flushOutbox('u1', { attempt: send });
    expect(items().map((i) => i.status)).toEqual(['rejected', 'sent']);
  });

  it('con la sesión vencida (401) no descarta nada', async () => {
    await add('a');
    const send = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'x'));

    await expect(flushOutbox('u1', { attempt: send })).resolves.toBe('needs-auth');
    expect(items()[0]?.status).toBe('pending');
  });

  it('nunca envía con la sesión de otro usuario lo que dejó pendiente otro', async () => {
    await add('de-u1', 'u1');
    await add('de-u2', 'u2');
    const send = vi.fn().mockResolvedValue({});

    await flushOutbox('u2', { attempt: send });
    expect(send.mock.calls).toEqual([[{ id: 'de-u2' }]]);
  });

  it('limpiar quita solo lo ya enviado', async () => {
    await add('a');
    await flushOutbox('u1', { attempt: () => Promise.resolve({}) });
    await add('b');

    await clearSent();
    expect(items().map((i) => i.id)).toEqual(['b']);
  });
});
