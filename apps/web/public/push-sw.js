/* global self -- corre dentro del service worker */
/*
 * Avisos de la app (Web Push, Fase 7, D16). El service worker de Workbox importa este archivo.
 * El servidor manda lo mínimo ({ kind, opponent, startsAt, url } de un partido; { kind, team,
 * url } del recordatorio del test; { kind, charge, url } de un cobro nuevo o de un patrocinio,
 * sin el valor); el texto y la hora (en la zona del celular) se arman aquí.
 *
 * La convocatoria y su recordatorio traen "Voy" y "No voy" (2026-11-06, Kevin): responden sin abrir la app, con la
 * cookie de la sesión, al API que dice sw-config.js. En iPhone no hay botones: el toque abre el
 * partido. Si no se puede responder (sin señal, sin sesión), abre el partido.
 *
 * Los avisos de un menor le llegan a su acudiente (escuelas, 2026-11-10) con `child` (su nombre
 * de pila) y la ruta de su pantalla (/deportistas/:minorId/…): el texto habla del niño y "Va" /
 * "No va" responden por él.
 */
const WHEN = new Intl.DateTimeFormat('es-419', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const WEEKDAY = new Intl.DateTimeFormat('es-419', { weekday: 'long' });
const DAY_KEY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "hoy", "mañana" o "el domingo", en la zona del celular. */
function dayWord(startsAt) {
  const at = new Date(startsAt);
  const today = DAY_KEY.format(new Date());
  const tomorrow = DAY_KEY.format(new Date(Date.now() + 86_400_000));
  const day = DAY_KEY.format(at);
  return day === today ? 'hoy' : day === tomorrow ? 'mañana' : `el ${WEEKDAY.format(at)}`;
}

/** El recordatorio de la convocatoria (2026-11-06): quién pregunta y cuándo es. */
function reminderBody(data, when) {
  return data.stage === 'manual'
    ? `Tu cuerpo técnico pregunta si vas. ${when}.`
    : `Faltas tú por responder. ${when}.`;
}

/** El texto para el acudiente: lo mismo, dicho del niño. null: el texto de siempre. */
function childText(data, when) {
  const name = data.child;
  switch (data.kind) {
    case 'match-called':
      return { title: `Convocaron a ${name}: ${data.opponent}`, body: `${when}. ¿Va?` };
    case 'training-called':
      return { title: `Convocaron a ${name} a entrenar`, body: `${when}. ¿Va?` };
    case 'match-reminder':
      return {
        title: `¿${name} va ${dayWord(data.startsAt)} contra ${data.opponent}?`,
        body: `Falta que respondas por ${name}. ${when}.`,
      };
    case 'training-reminder':
      return {
        title: `¿${name} va a entrenar ${dayWord(data.startsAt)}?`,
        body: `Falta que respondas por ${name}. ${when}.`,
      };
    case 'lineup-published':
      return {
        title: `Ya está la alineación: ${data.opponent}`,
        body: `${when}. Mira lo de ${name}.`,
      };
    case 'match-figure':
      return {
        title: `¡${name} fue la figura contra ${data.opponent}!`,
        body: 'Felicitaciones de su profe.',
      };
    case 'charge-created':
      return {
        title: `Nuevo cobro a nombre de ${name}: ${data.charge}`,
        body: 'Toca para ver cuánto es y avisar cuando pagues.',
      };
    case 'charge-covered':
      return {
        title: `Le cubrieron la parte a ${name}: ${data.charge}`,
        body: 'Ya no debe nada de este cobro.',
      };
    case 'charge-due':
      return {
        title: `${data.when === 'today' ? 'Hoy' : 'Mañana'} vence: ${data.charge}`,
        body: `Falta la parte de ${name}. Toca para ver cuánto y avisar cuando pagues.`,
      };
    case 'group-moved':
      return {
        title: `${name} pasó a ${data.team}`,
        body: 'Su profe le cambió el grupo. Toca para ver sus entrenos.',
      };
    case 'charges-reminder':
      return {
        title: `${name} tiene cobros pendientes`,
        body: 'Toca para ver cuánto y avisar cuando pagues.',
      };
    default:
      return null;
  }
}

/**
 * El texto de cada tipo de aviso. Uno que este service worker no conoce (lo agregó una versión
 * más nueva del servidor y el celular todavía no abrió la app) lleva un texto neutro: nunca el
 * de otro tipo.
 */
function noticeText(data, when) {
  const forChild = typeof data.child === 'string' && data.child ? childText(data, when) : null;
  if (forChild) return forChild;
  switch (data.kind) {
    case 'match-called':
      return { title: `Te convocaron: ${data.opponent}`, body: `${when}. ¿Vas?` };
    case 'training-called':
      return { title: 'Te convocaron a entrenar', body: `${when}. ¿Vas?` };
    case 'match-reminder':
      return {
        title: `¿Vas ${dayWord(data.startsAt)} contra ${data.opponent}?`,
        body: reminderBody(data, when),
      };
    case 'training-reminder':
      return {
        title: `¿Vas a entrenar ${dayWord(data.startsAt)}?`,
        body: reminderBody(data, when),
      };
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
    case 'group-moved':
      return {
        title: `Te pasaron a ${data.team}`,
        body: 'Tu profe te cambió de grupo. Toca para ver los entrenos.',
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

/** Las convocatorias (y sus recordatorios) se responden desde el aviso. */
const REPLY_KINDS = new Set([
  'match-called',
  'training-called',
  'match-reminder',
  'training-reminder',
]);
const REPLY_ACTIONS = [
  { action: 'yes', title: 'Voy' },
  { action: 'no', title: 'No voy' },
];
/** Por el niño (2026-11-10). */
const CHILD_REPLY_ACTIONS = [
  { action: 'yes', title: 'Va' },
  { action: 'no', title: 'No va' },
];

/**
 * El equipo y el partido de "/equipos/:teamId/partidos/:matchId", o del niño en
 * "/deportistas/:minorId/equipos/:teamId/partidos/:matchId" (con `minorId`); o null.
 */
function matchOf(url) {
  const own = /^\/equipos\/([^/]+)\/partidos\/([^/?#]+)$/.exec(url);
  if (own) return { teamId: own[1], matchId: own[2] };
  const child = /^\/deportistas\/([^/]+)\/equipos\/([^/]+)\/partidos\/([^/?#]+)$/.exec(url);
  return child ? { minorId: child[1], teamId: child[2], matchId: child[3] } : null;
}

/** El aviso que reemplaza a la convocatoria cuando se respondió desde ahí. */
function replyText(reply, opponent, child) {
  const what = opponent ? `contra ${opponent}` : 'al entreno';
  if (child) {
    return {
      title: reply === 'yes' ? `Listo, ${child} va ${what}` : `Listo, ${child} no va ${what}`,
      body: 'Si cambian los planes, respóndelo en la app hasta la hora del partido.',
    };
  }
  return {
    title: reply === 'yes' ? `Listo, vas ${what}` : `Listo, no vas ${what}`,
    body: 'Si cambias de idea, respóndelo en la app hasta la hora del partido.',
  };
}

/** Guarda la respuesta en el API con la sesión del celular; true si quedó. */
async function sendReply({ minorId, teamId, matchId }, reply) {
  const api = self.SDL_API_URL || self.location.origin;
  const path = minorId
    ? `/api/v1/me/children/${minorId}/teams/${teamId}/matches/${matchId}/reply`
    : `/api/v1/teams/${teamId}/matches/${matchId}/reply`;
  try {
    const res = await fetch(new URL(path, api), {
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
            data: {
              url: data.url,
              kind: data.kind,
              // El entreno no tiene rival: "Listo, vas al entreno".
              opponent: data.kind.startsWith('training') ? null : (data.opponent ?? null),
              child: typeof data.child === 'string' ? data.child : null,
            },
            actions: data.child ? CHILD_REPLY_ACTIONS : REPLY_ACTIONS,
          }
        : { data: { url: data.url } }),
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url = '/', kind, opponent = null, child = null } = event.notification.data ?? {};
  const target = matchOf(url);
  const reply = event.action === 'yes' || event.action === 'no' ? event.action : null;
  event.waitUntil(
    (async () => {
      if (!reply || !target || !REPLY_KINDS.has(kind)) return openApp(url);
      if (!(await sendReply(target, reply))) return openApp(url);
      const { title, body } = replyText(reply, opponent, child);
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
