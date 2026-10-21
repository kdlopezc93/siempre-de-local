import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { flushOutbox, outboxStore, type OutboxSender } from './outbox';

/** Ítems de la cola y resultado del último vaciado. */
export function useOutbox() {
  return useSyncExternalStore(outboxStore.subscribe, outboxStore.getSnapshot);
}

/** true si el navegador cree que hay red. En iOS puede tardar unos segundos en enterarse. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine);
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

/**
 * Vacía la cola al montar, al volver la red y al volver a la app. Background Sync
 * no existe en iOS, así que la sincronización la dispara la propia app.
 */
export function useOutboxSync(userId: string, senders: Record<string, OutboxSender>) {
  const flush = useCallback(() => flushOutbox(userId, senders), [userId, senders]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };
    const onOnline = () => void flush();
    void flush();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [flush]);

  return flush;
}
