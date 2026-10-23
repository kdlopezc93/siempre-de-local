import { PushPublicKeyResponseSchema } from '@sdl/contracts';

import { apiFetch, apiRequest } from '../api/http';

export type PushState = 'on' | 'off' | 'denied' | 'unsupported' | 'ios-install' | 'not-configured';

const supported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/** En iPhone los avisos solo existen con la app agregada al inicio (iOS 16.4+). */
const iosInBrowser = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;

async function registration() {
  // Sin service worker (modo desarrollo del túnel) no hay avisos.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
  return reg;
}

/** Cómo están los avisos en este celular. */
export async function pushState(): Promise<PushState> {
  if (iosInBrowser()) return 'ios-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

/** La llave del servidor viene en base64url; el navegador la quiere en bytes. */
function toBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Pide permiso (tiene que ser tras un toque), se suscribe y avisa al servidor. */
export async function enablePush(): Promise<PushState> {
  const { publicKey } = await apiRequest('/api/v1/push/public-key', PushPublicKeyResponseSchema);
  if (!publicKey) return 'not-configured';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(publicKey),
    }));
  await apiFetch('/api/v1/me/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const subscription = reg ? await reg.pushManager.getSubscription() : null;
  if (subscription) {
    await apiFetch('/api/v1/me/push-subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  return 'off';
}
