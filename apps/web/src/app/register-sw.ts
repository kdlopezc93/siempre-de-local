import { registerSW } from 'virtual:pwa-register';

/** Registra el service worker; con autoUpdate, la versión nueva se activa sola. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({ immediate: true });
}
