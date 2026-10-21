import type { SpikeAttemptRequest } from '@sdl/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { fetchSpikeQuestionnaire, submitSpikeAttempt } from '../../shared/api/spike-pwa';
import { enqueue, requestPersistentStorage, type OutboxSender } from '../../shared/offline/outbox';
import { useOutboxSync } from '../../shared/offline/use-outbox';

const KIND = 'spike-attempt';
const SENDERS: Record<string, OutboxSender> = {
  [KIND]: (payload) => submitSpikeAttempt(payload as SpikeAttemptRequest),
};

export function useSpikeQuestionnaire() {
  return useQuery({
    queryKey: ['spike', 'questionnaire'],
    queryFn: fetchSpikeQuestionnaire,
    // Sin esto TanStack Query ni lo intenta sin red; el service worker sí puede responder.
    networkMode: 'offlineFirst',
    staleTime: Infinity,
  });
}

/** Todo envío pasa por la cola, haya red o no: un solo camino que probar. */
export function useSpikeSubmit(userId: string) {
  const flush = useOutboxSync(userId, SENDERS);

  async function submit(attempt: Omit<SpikeAttemptRequest, 'clientAttemptId' | 'submittedAt'>) {
    const clientAttemptId = crypto.randomUUID();
    const payload: SpikeAttemptRequest = {
      ...attempt,
      clientAttemptId,
      submittedAt: new Date().toISOString(),
    };
    await enqueue({ id: clientAttemptId, kind: KIND, userId, payload });
    void requestPersistentStorage();
    await flush();
  }

  return { submit, flush };
}

export interface DeviceState {
  installed: boolean;
  serviceWorker: boolean;
  persisted: boolean | null;
}

/** Diagnóstico del dispositivo para la prueba en celulares. */
export function useDeviceState(): DeviceState {
  const [state, setState] = useState<DeviceState>(() => ({
    installed:
      window.matchMedia('(display-mode: standalone)').matches ||
      // Safari en iOS no implementa display-mode en versiones viejas.
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    serviceWorker: Boolean(navigator.serviceWorker?.controller),
    persisted: null,
  }));

  useEffect(() => {
    let cancelled = false;
    void navigator.storage?.persisted?.().then((persisted) => {
      if (!cancelled) setState((s) => ({ ...s, persisted }));
    });
    const onController = () =>
      setState((s) => ({ ...s, serviceWorker: Boolean(navigator.serviceWorker?.controller) }));
    navigator.serviceWorker?.addEventListener('controllerchange', onController);
    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
    };
  }, []);

  return state;
}
