import { registerSW } from 'virtual:pwa-register';

import { matchesKey } from '../features/matches/use-matches';
import { queryClient } from './query-client';

/** Registra el service worker; con autoUpdate, la versión nueva se activa sola. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
  // "Voy / No voy" desde el aviso (2026-11-06): si la app está abierta, que pida de nuevo los
  // partidos del equipo para mostrar la respuesta.
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data: unknown = event.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      data.type === 'sdl:match-replied' &&
      'teamId' in data &&
      typeof data.teamId === 'string'
    ) {
      void queryClient.invalidateQueries({ queryKey: matchesKey(data.teamId) });
    }
  });
}
