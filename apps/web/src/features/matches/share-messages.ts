import type { Match, MatchRoster } from '@sdl/contracts';
import { MATCH_KIND_LABELS } from '@sdl/domain';

import { matchDay, matchWhen } from './match-view';

/*
 * "Mandar al grupo" (2026-11-06, Kevin): el mensaje que el cuerpo técnico pega en el grupo de
 * WhatsApp del equipo, con el enlace a la pantalla donde se resuelve. Los asteriscos son las
 * negritas de WhatsApp.
 */

const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Juan, Pipe y Ciro". */
export function namesList(names: readonly string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : (names[0] ?? '');
}

/** "⚽ *Amistoso vs Real Bosa*", "⚽ *Campeonato vs Real Bosa* (Liga del barrio)", "🏃 *Entreno*". */
function headline(match: Pick<Match, 'kind' | 'opponent' | 'tournament'>): string {
  if (!match.opponent) return '🏃 *Entreno*';
  const tournament = match.tournament ? ` (${match.tournament.name})` : '';
  return `⚽ *${MATCH_KIND_LABELS[match.kind]} vs ${match.opponent}*${tournament}`;
}

/**
 * La convocatoria: cuándo y dónde, cuántos van y quiénes faltan por responder (con nombre: el
 * técnico lo decide, 2026-11-06). Los lesionados no cuentan como pendientes.
 */
export function callUpMessage(match: Match, roster: MatchRoster, url: string): string {
  const pending = roster.filter((p) => p.reply === null && !p.injured).map((p) => p.displayName);
  return [
    headline(match),
    `${upper(matchWhen(match.startsAt))} · ${match.place}`,
    `Van ${match.replies.yes} · No van ${match.replies.no}`,
    pending.length ? `Faltan por responder: ${namesList(pending)}` : 'Ya respondieron todos',
    `Responde acá 👉 ${url}`,
  ].join('\n');
}

/**
 * "Día de partido" (2026-11-10): con el afiche, sin la lista (ya está en la imagen; a los del
 * grupo no les gustaba verla dos veces). Solo si sale sin imagen (`withNames`), los convocados
 * con su dorsal, para que cada uno se busque.
 */
export function matchdayMessage(
  match: Pick<Match, 'kind' | 'opponent' | 'tournament' | 'startsAt' | 'place'>,
  going: readonly { displayName: string; jerseyNumber: number | null }[],
  url: string,
  { withNames = false }: { withNames?: boolean } = {},
): string {
  const names = going.map((p) =>
    p.jerseyNumber !== null ? `${p.jerseyNumber} ${p.displayName}` : p.displayName,
  );
  return [
    `🔥 *Día de partido*`,
    headline(match),
    `${upper(matchWhen(match.startsAt))} · ${match.place}`,
    ...(withNames ? [`Convocados (${going.length}): ${namesList(names)}`] : []),
    `Detalles 👉 ${url}`,
  ].join('\n');
}

/** La alineación publicada: va con su imagen cuando el celular deja compartirla. */
export function lineupMessage(match: Pick<Match, 'startsAt' | 'opponent'>, url: string): string {
  const vs = match.opponent ? ` vs ${match.opponent}` : '';
  return [
    `📋 *Ya está la alineación para el ${matchDay(match.startsAt)}${vs}*`,
    `Mira dónde juegas 👉 ${url}`,
  ].join('\n');
}
