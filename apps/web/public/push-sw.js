/* global self -- corre dentro del service worker */
/*
 * Avisos de la app (Web Push, Fase 7, D16). El service worker de Workbox importa este archivo.
 * El servidor manda lo mínimo ({ kind, opponent, startsAt, url }); el texto y la hora (en la
 * zona del celular) se arman aquí.
 */
const WHEN = new Intl.DateTimeFormat('es-419', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * El texto de cada tipo de aviso. Uno que este service worker no conoce (lo agregó una versión
 * más nueva del servidor y el celular todavía no abrió la app) lleva un texto neutro: nunca el
 * de otro tipo.
 */
function noticeText(data, when) {
  switch (data.kind) {
    case 'match-called':
      return { title: `Te convocaron: ${data.opponent}`, body: `${when}. ¿Vas?` };
    case 'lineup-published':
      return {
        title: `Ya está la alineación: ${data.opponent}`,
        body: `${when}. Mira dónde juegas.`,
      };
    case 'match-figure':
      return {
        title: `¡Fuiste la figura contra ${data.opponent}!`,
        body: 'Felicitaciones de tu cuerpo técnico.',
      };
    default:
      return { title: `Novedades del partido: ${data.opponent}`, body: 'Toca para verlas.' };
  }
}

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || typeof data.url !== 'string' || !data.url.startsWith('/')) return;
  const when = data.startsAt ? WHEN.format(new Date(data.startsAt)) : '';
  const { title, body } = noticeText(data, when);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'es-419',
      // Uno por partido y tipo: republicar reemplaza el aviso anterior.
      tag: `${data.kind}:${data.url}`,
      data: { url: data.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
