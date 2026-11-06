/* global self -- corre dentro del service worker */
/*
 * Avisos de la app (Web Push, Fase 7, D16). El service worker de Workbox importa este archivo.
 * El servidor manda lo mínimo ({ kind, opponent, startsAt, url } de un partido; { kind, team,
 * url } del recordatorio del test; { kind, charge, url } de un cobro nuevo o de un patrocinio,
 * sin el valor); el texto y la hora (en la zona del celular) se arman aquí.
 *
 * La convocatoria trae "Voy" y "No voy" (2026-11-06, Kevin): responden sin abrir la app, con la
 * cookie de la sesión, al API que dice sw-config.js. En iPhone no hay botones: el toque abre el
 * partido. Si no se puede responder (sin señal, sin sesión), abre el partido.
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
    case 'training-called':
      return { title: 'Te convocaron a entrenar', body: `${when}. ¿Vas?` };
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
    case 'charge-created':
      return {
        title: `Nuevo cobro del equipo: ${data.charge}`,
        body: 'Toca para ver cuánto te toca y avisar cuando pagues.',
      };
    case 'charge-covered':
      return {
        title: `Te cubrieron tu parte: ${data.charge}`,
        body: 'Ya no debes nada de este cobro.',
      };
    case 'charge-sponsor':
      return {
        title: `Asumiste la parte de un compañero: ${data.charge}`,
        body: 'Toca para ver cuánto es y avisar cuando pagues.',
      };
    case 'charge-due':
      return {
        title: `${data.when === 'today' ? 'Hoy' : 'Mañana'} vence: ${data.charge}`,
        body: 'Todavía debes tu parte. Toca para ver cuánto y avisar cuando pagues.',
      };
    case 'charges-reminder':
      return {
        title: `Tienes cobros pendientes en ${data.team}`,
        body: 'Toca para ver cuánto y avisar cuando pagues.',
      };
    case 'test-reminder':
      return {
        title: '¿Ya hiciste tu test de posición?',
        body: `Tu cuerpo técnico de ${data.team} te lo recuerda. Son unos minutos.`,
      };
    default:
      return data.opponent
        ? { title: `Novedades del partido: ${data.opponent}`, body: 'Toca para verlas.' }
        : { title: 'Novedades de tu equipo', body: 'Toca para verlas.' };
  }
}

/** Las convocatorias se responden desde el aviso. */
const REPLY_KINDS = new Set(['match-called', 'training-called']);
const REPLY_ACTIONS = [
  { action: 'yes', title: 'Voy' },
  { action: 'no', title: 'No voy' },
];

/** El equipo y el partido de "/equipos/:teamId/partidos/:matchId", o null. */
function matchOf(url) {
  const found = /^\/equipos\/([^/]+)\/partidos\/([^/?#]+)$/.exec(url);
  return found ? { teamId: found[1], matchId: found[2] } : null;
}

/** El aviso que reemplaza a la convocatoria cuando se respondió desde ahí. */
function replyText(reply, opponent) {
  const what = opponent ? `contra ${opponent}` : 'al entreno';
  return {
    title: reply === 'yes' ? `Listo, vas ${what}` : `Listo, no vas ${what}`,
    body: 'Si cambias de idea, respóndelo en la app hasta la hora del partido.',
  };
}

/** Guarda la respuesta en el API con la sesión del celular; true si quedó. */
async function sendReply({ teamId, matchId }, reply) {
  const api = self.SDL_API_URL || self.location.origin;
  try {
    const res = await fetch(new URL(`/api/v1/teams/${teamId}/matches/${matchId}/reply`, api), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reply }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Abre la app en `url` (o la lleva ahí si ya está abierta). */
async function openApp(url) {
  const href = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((w) => w.url.startsWith(self.location.origin));
  if (open) {
    await open.navigate(href);
    return open.focus();
  }
  return self.clients.openWindow(href);
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
  const answerable = REPLY_KINDS.has(data.kind) && matchOf(data.url) !== null;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      lang: 'es-419',
      // Uno por partido (o pantalla) y tipo: republicar reemplaza el aviso anterior.
      tag: `${data.kind}:${data.url}`,
      // La convocatoria guarda qué es y contra quién, para responder desde el aviso.
      ...(answerable
        ? {
            data: { url: data.url, kind: data.kind, opponent: data.opponent ?? null },
            actions: REPLY_ACTIONS,
          }
        : { data: { url: data.url } }),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/', kind, opponent = null } = event.notification.data ?? {};
  const target = matchOf(url);
  const reply = event.action === 'yes' || event.action === 'no' ? event.action : null;
  event.waitUntil(
    (async () => {
      if (!reply || !target || !REPLY_KINDS.has(kind)) return openApp(url);
      if (!(await sendReply(target, reply))) return openApp(url);
      const { title, body } = replyText(reply, opponent);
      await self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        lang: 'es-419',
        tag: `${kind}:${url}`,
        data: { url },
      });
      // Si la app está abierta, que vuelva a pedir el partido.
      const windows = await self.clients.matchAll({ type: 'window' });
      for (const w of windows) w.postMessage({ type: 'sdl:match-replied', ...target });
    })(),
  );
});
