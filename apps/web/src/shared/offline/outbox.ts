import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

import { ApiError } from '../api/http';

/**
 * Cola de envíos offline (ADR-06): lo que el jugador completa sin conexión queda en
 * IndexedDB y se envía al volver la red. El servidor deduplica por el id del envío
 * (`clientAttemptId`), así que reenviar es seguro.
 */

export type OutboxStatus = 'pending' | 'sent' | 'rejected';

export interface OutboxItem {
  /** Id del envío generado en el cliente; el servidor lo usa para deduplicar. */
  id: string;
  kind: string;
  /** Dueño del envío: solo se manda con la sesión de ese usuario. */
  userId: string;
  payload: unknown;
  createdAt: string;
  status: OutboxStatus;
  tries: number;
  sentAt?: string;
  /** Respuesta del servidor al enviarlo. */
  result?: unknown;
  lastError?: string;
}

/** Envía un ítem; lanza ApiError o el TypeError de fetch si no hay red. */
export type OutboxSender = (payload: unknown) => Promise<unknown>;

export type FlushOutcome = 'done' | 'offline' | 'needs-auth' | 'retry-later';

interface OfflineDb extends DBSchema {
  outbox: { key: string; value: OutboxItem; indexes: { createdAt: string } };
}

const DB_NAME = 'sdl-offline';
const LOCK_NAME = 'sdl-outbox-flush';
/** Errores del cliente que no se arreglan reintentando. */
const RETRYABLE_4XX = new Set([401, 408, 429]);

let dbPromise: Promise<IDBPDatabase<OfflineDb>> | null = null;

function db(): Promise<IDBPDatabase<OfflineDb>> {
  dbPromise ??= openDB<OfflineDb>(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore('outbox', { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt');
    },
  });
  return dbPromise;
}

// --- Suscripción (para useSyncExternalStore) ---

export interface OutboxState {
  items: readonly OutboxItem[];
  /** Resultado del último vaciado; null si aún no se intentó. */
  lastOutcome: FlushOutcome | null;
}

const listeners = new Set<() => void>();
let snapshot: OutboxState = { items: [], lastOutcome: null };

async function refresh(lastOutcome = snapshot.lastOutcome): Promise<void> {
  const items = await (await db()).getAllFromIndex('outbox', 'createdAt');
  snapshot = { items, lastOutcome };
  for (const listener of listeners) listener();
}

export const outboxStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (listeners.size === 1) void refresh();
    return () => listeners.delete(listener);
  },
  getSnapshot: (): OutboxState => snapshot,
};

// --- Operaciones ---

export async function enqueue(
  item: Pick<OutboxItem, 'id' | 'kind' | 'userId' | 'payload'>,
): Promise<void> {
  await (
    await db()
  ).put('outbox', {
    ...item,
    createdAt: new Date().toISOString(),
    status: 'pending',
    tries: 0,
  });
  await refresh();
}

export async function clearSent(): Promise<void> {
  const database = await db();
  const tx = database.transaction('outbox', 'readwrite');
  for (const item of await tx.store.getAll()) {
    if (item.status === 'sent') await tx.store.delete(item.id);
  }
  await tx.done;
  await refresh();
}

/**
 * Envía en orden los pendientes del usuario. Se detiene en el primer fallo que
 * merezca reintento (sin red, 5xx, sesión vencida) para no reordenar envíos.
 */
export function flushOutbox(
  userId: string,
  senders: Record<string, OutboxSender>,
): Promise<FlushOutcome> {
  // Un solo vaciado a la vez, también entre pestañas (Web Locks; iOS ≥ 15.4).
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(LOCK_NAME, () => flushUnlocked(userId, senders));
  }
  return flushUnlocked(userId, senders);
}

async function flushUnlocked(
  userId: string,
  senders: Record<string, OutboxSender>,
): Promise<FlushOutcome> {
  const database = await db();
  const pending = (await database.getAllFromIndex('outbox', 'createdAt')).filter(
    (item) => item.status === 'pending' && item.userId === userId,
  );

  let outcome: FlushOutcome = 'done';
  for (const item of pending) {
    const send = senders[item.kind];
    if (!send) continue;

    try {
      const result = await send(item.payload);
      const { lastError: _, ...rest } = item;
      await database.put('outbox', {
        ...rest,
        status: 'sent',
        tries: item.tries + 1,
        sentAt: new Date().toISOString(),
        result,
      });
    } catch (error) {
      outcome = classify(error);
      const rejected = outcome === 'done';
      await database.put('outbox', {
        ...item,
        status: rejected ? 'rejected' : 'pending',
        tries: item.tries + 1,
        lastError: describe(error),
      });
      if (!rejected) break;
    }
  }

  await refresh(outcome);
  return outcome;
}

/** 'done' = el servidor lo rechazó para siempre; el resto se reintenta luego. */
function classify(error: unknown): FlushOutcome {
  if (!(error instanceof ApiError)) return 'offline';
  if (error.status === 401) return 'needs-auth';
  if (error.status >= 400 && error.status < 500 && !RETRYABLE_4XX.has(error.status)) return 'done';
  return 'retry-later';
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return `${error.status} ${error.code}`;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Pide al navegador que no borre IndexedDB ni el caché por falta de espacio.
 * En iOS, sin instalar la PWA, Safari borra los datos tras 7 días sin uso.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/** Solo para tests: cierra y olvida la conexión. */
export async function resetOutboxForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  snapshot = { items: [], lastOutcome: null };
}
