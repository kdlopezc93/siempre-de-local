import { CHARGE_KIND_LABELS, initialsOf, MATCH_KIND_LABELS } from '@sdl/domain';

import type { ChargeForPreview, MatchForPreview } from './ports/previews.ports.js';

/*
 * Los textos y la imagen de la vista previa (2026-11-06, nivel 2): el escudo del equipo (sus
 * iniciales), qué es, el rival o el cobro en grande y la hora en volt. En la hora de Colombia:
 * quien la pide es el servidor de WhatsApp, no el celular.
 */
const ZONE = 'America/Bogota';
const TIME = new Intl.DateTimeFormat('es-419', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: ZONE,
});
const DAY = new Intl.DateTimeFormat('es-419', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: ZONE,
});

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "3:00 p. m." y "sábado 8 nov". */
export function previewWhen(at: Date) {
  const part = (format: Intl.DateTimeFormat, type: Intl.DateTimeFormatPartTypes) =>
    format.formatToParts(at).find((p) => p.type === type)?.value ?? '';
  const period = part(TIME, 'dayPeriod').replace('p.m.', 'p. m.').replace('a.m.', 'a. m.');
  return {
    time: `${part(TIME, 'hour')}:${part(TIME, 'minute')}`,
    period,
    day: `${part(DAY, 'weekday')} ${part(DAY, 'day')} ${part(DAY, 'month')}`,
  };
}

/** Lo que dice una vista previa: arriba qué es, en grande el rival o el cobro, abajo cuándo. */
export interface PreviewCard {
  team: string;
  kicker: string;
  headline: string;
  /** La línea volt: la hora, o de qué partido es el cobro. */
  detail: string;
  title: string;
  description: string;
}

export function matchCard(m: MatchForPreview): PreviewCard {
  const when = previewWhen(m.startsAt);
  const date = `${when.day}, ${when.time} ${when.period}`;
  const kind = m.tournament ?? MATCH_KIND_LABELS[m.kind];
  const headline = m.opponent ? `vs ${m.opponent}` : 'Entreno';
  return {
    team: m.team,
    kicker: m.cancelled ? `Cancelado · ${kind}` : `Convocatoria · ${kind}`,
    headline,
    detail: date,
    title: m.opponent ? `${m.team} vs ${m.opponent}` : `${m.team}: entreno`,
    // La hora ya termina en punto ("p. m."): se separa con un punto medio, no con otro punto.
    description: m.cancelled ? `${upper(date)} · Cancelado` : `${upper(date)} · ¿Vas?`,
  };
}

export function chargeCard(c: ChargeForPreview): PreviewCard {
  const what = c.title ?? CHARGE_KIND_LABELS[c.kind];
  const of = c.match
    ? `${c.match.opponent ? `vs ${c.match.opponent}` : 'Entreno'}, ${previewWhen(c.match.startsAt).day}`
    : (c.tournament ?? 'Cobro del equipo');
  return {
    team: c.team,
    kicker: c.cancelled ? 'Cobro anulado' : 'Cobro del equipo',
    headline: what,
    detail: of,
    title: `${c.team}: ${what}`,
    description: c.cancelled
      ? 'Este cobro se anuló.'
      : `${upper(of)}. Avisa en la app cuando pagues.`,
  };
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Un tamaño de letra para que `text` quepa en `width` (a ojo: no hay cómo medir en SVG). */
const sized = (text: string, max: number, width: number, ratio = 0.56) =>
  Math.max(40, Math.min(max, Math.floor(width / (Math.max(text.length, 1) * ratio))));

/** La imagen 1200×630, como en la maqueta: cobalto, el escudo en volt y la tiza en blanco. */
export function previewSvg(card: PreviewCard): string {
  const head = sized(card.headline, 112, 1060);
  const team = sized(card.team, 48, 820, 0.58);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#3155e8"/>
  <rect y="596" width="1200" height="34" fill="#d4f34a"/>
  <circle cx="145" cy="145" r="75" fill="#d4f34a"/>
  <text x="145" y="167" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="60" fill="#14161c">${escape(initialsOf(card.team))}</text>
  <text x="250" y="135" font-family="Plus Jakarta Sans" font-weight="700" font-size="${team}" fill="#ffffff">${escape(card.team)}</text>
  <text x="250" y="188" font-family="Plus Jakarta Sans" font-weight="600" font-size="32" fill="#c9d4fb">${escape(card.kicker)}</text>
  <text x="66" y="${300 + head * 0.8}" font-family="Plus Jakarta Sans" font-weight="800" font-size="${head}" letter-spacing="-2" fill="#ffffff">${escape(card.headline)}</text>
  <text x="70" y="500" font-family="Space Grotesk" font-weight="700" font-size="${sized(card.detail, 56, 1060, 0.55)}" fill="#d4f34a">${escape(upper(card.detail))}</text>
  <text x="70" y="568" font-family="Plus Jakarta Sans" font-weight="600" font-size="28" fill="#c9d4fb">Siempre de Local</text>
</svg>`;
}
