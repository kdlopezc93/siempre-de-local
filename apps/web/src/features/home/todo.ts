import type {
  CertPositionsResponse,
  LineupListResponse,
  Match,
  SquadResponse,
} from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';

import { matchWhen } from '../matches/match-view';

export type TodoIcon = 'exam' | 'test' | 'assess' | 'card' | 'review' | 'lineup' | 'match';

export interface Todo {
  id: string;
  /** Menor = más urgente. El primero va como bloque ámbar. */
  priority: number;
  who: 'staff' | 'player';
  icon: TodoIcon;
  /** Como bloque ámbar ("Valora a 4 jugadores")… */
  title: string;
  /** …y como fila, más corto ("Sin valorar"), con `count` a la derecha. */
  short?: string;
  count?: number;
  detail?: string;
  to: string;
}

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short' });
const day = (iso: string) => DAY.format(new Date(iso));
const name = (pos: keyof typeof POSITIONS) => POSITIONS[pos].name;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Lo que le toca al jugador (07 §4.3): el examen a medias (el reloj corre), las
 * re-evaluaciones, el test si no lo hizo y los exámenes que ya puede presentar.
 */
export function playerTodos(input: {
  teamId: string;
  testDone: boolean;
  positions: CertPositionsResponse['positions'];
  now: Date;
}): Todo[] {
  const { teamId, testDone, positions, now } = input;
  const todos: Todo[] = [];
  const active = positions.find((p) => p.activeExamId)?.activeExamId;
  if (active) {
    todos.push({
      id: 'exam-active',
      priority: 0,
      who: 'player',
      icon: 'exam',
      title: 'Termina tu examen',
      detail: 'El reloj sigue corriendo',
      to: `/conocimiento/examen/${active}`,
    });
  }
  for (const p of positions) {
    if (!p.review || (p.review.status !== 'pending' && p.review.status !== 'expired')) continue;
    const expired = p.review.status === 'expired';
    todos.push({
      id: `review-${p.position}`,
      priority: expired ? 1 : 3,
      who: 'player',
      icon: 'review',
      title: `Re-evaluación de ${name(p.position)}`,
      detail: expired ? `Venció el ${day(p.review.dueAt)}` : `Hasta el ${day(p.review.dueAt)}`,
      to: '/conocimiento',
    });
  }
  if (!testDone) {
    todos.push({
      id: 'test',
      priority: 2,
      who: 'player',
      icon: 'test',
      title: 'Haz tu test de posición',
      detail: '20 preguntas sobre situaciones de juego',
      to: `/equipos/${teamId}/test`,
    });
  }
  const ready = positions.filter(
    (p) => !p.review && !active && (p.nextAttemptAt === null || new Date(p.nextAttemptAt) <= now),
  );
  for (const p of ready) {
    todos.push({
      id: `exam-${p.position}`,
      priority: 6,
      who: 'player',
      icon: 'exam',
      title: p.best
        ? `Ya puedes repetir el examen de ${name(p.position)}`
        : `Presenta el examen de ${name(p.position)}`,
      to: '/conocimiento',
    });
  }
  return todos;
}

/**
 * Lo que le toca al cuerpo técnico: valorar (primero, y a ciegas), quién falta de test o
 * de tarjeta y las re-evaluaciones vencidas.
 */
export function staffTodos(input: { teamId: string; squad: SquadResponse['players'] }): Todo[] {
  const { teamId, squad } = input;
  const squadPath = `/equipos/${teamId}/plantilla`;
  const todos: Todo[] = [];
  const unassessed = squad.filter((p) => !p.assessedByMe).length;
  if (unassessed) {
    todos.push({
      id: 'assess',
      priority: 1,
      who: 'staff',
      icon: 'assess',
      title: `Valora a ${plural(unassessed, 'jugador', 'jugadores')}`,
      short: 'Sin valorar',
      count: unassessed,
      detail: 'Antes de mirar su test',
      to: `${squadPath}?filtro=por-valorar`,
    });
  }
  const expired = squad.filter((p) => p.knowledge.some((k) => k.review === 'expired')).length;
  if (expired) {
    todos.push({
      id: 'reviews-expired',
      priority: 2,
      who: 'staff',
      icon: 'review',
      title: `${plural(expired, 're-evaluación vencida', 're-evaluaciones vencidas')}`,
      short: 'Re-evaluación vencida',
      count: expired,
      to: `${squadPath}?filtro=re-evaluacion`,
    });
  }
  const noCard = squad.filter((p) => !p.card).length;
  if (noCard) {
    todos.push({
      id: 'card',
      priority: 4,
      who: 'staff',
      icon: 'card',
      title: `Puntúa la tarjeta de ${plural(noCard, 'jugador', 'jugadores')}`,
      short: 'Sin tarjeta',
      count: noCard,
      to: `${squadPath}?filtro=sin-tarjeta`,
    });
  }
  const noTest = squad.filter((p) => p.test.status === 'none').length;
  if (noTest) {
    todos.push({
      id: 'no-test',
      priority: 5,
      who: 'staff',
      icon: 'test',
      title: `${plural(noTest, 'jugador', 'jugadores')} sin test`,
      short: 'Sin test',
      count: noTest,
      detail: 'Recuérdales que lo hagan',
      to: `${squadPath}?filtro=sin-test`,
    });
  }
  return todos;
}

/** La última alineación guardada, como atajo (no es un pendiente). */
export function lastLineup(teamId: string, lineups: LineupListResponse['items']): Todo | null {
  const last = [...lineups].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return last
    ? {
        id: 'lineup',
        priority: 9,
        who: 'staff',
        icon: 'lineup',
        title: `Última alineación: ${last.name}`,
        to: `/equipos/${teamId}/alineaciones/${last.id}`,
      }
    : null;
}

/** Ordena: el primero es el bloque ámbar; el resto, filas. */
export function arrange(todos: readonly Todo[]): { lead: Todo | null; rest: Todo[] } {
  const sorted = [...todos].sort((a, b) => a.priority - b.priority);
  return { lead: sorted[0] ?? null, rest: sorted.slice(1) };
}

/**
 * Partidos (Fase 7, D16: el aviso va en el inicio). Al jugador: las convocatorias que no
 * respondió (lo primero después de un examen a medias). Al cuerpo técnico: el próximo partido
 * con gente sin responder y, ya jugado, cargar el resultado.
 */
export function matchTodos(input: {
  teamId: string;
  matches: readonly Match[];
  player: boolean;
  staff: boolean;
  /** Para saber si fue la figura. */
  meId?: string;
  now?: Date;
}): Todo[] {
  const { teamId, matches, player, staff, meId, now = new Date() } = input;
  const open = matches.filter((m) => m.open).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const path = (m: Match) => `/equipos/${teamId}/partidos/${m.id}`;
  const todos: Todo[] = [];
  if (player) {
    for (const m of open.filter((x) => !x.myReply)) {
      todos.push({
        id: `match-${m.id}`,
        priority: 1,
        who: 'player',
        icon: 'match',
        title: `Te convocaron: ${m.opponent}`,
        detail: `${matchWhen(m.startsAt)}. ¿Vas?`,
        to: path(m),
      });
    }
  }
  // Ya está la alineación (D17): el jugador la ve hasta la hora del partido.
  if (player) {
    for (const m of open.filter((x) => x.published)) {
      todos.push({
        id: `match-lineup-${m.id}`,
        priority: 4,
        who: 'player',
        icon: 'lineup',
        title: `Ya está la alineación: ${m.opponent}`,
        detail: matchWhen(m.startsAt),
        to: path(m),
      });
    }
  }
  const next = open[0];
  if (staff && next && next.replies.pending > 0) {
    todos.push({
      id: `match-pending-${next.id}`,
      priority: 3,
      who: 'staff',
      icon: 'match',
      title: `${next.opponent}: ${plural(next.replies.pending, 'jugador sin responder', 'jugadores sin responder')}`,
      short: `${next.opponent}, sin responder`,
      count: next.replies.pending,
      to: path(next),
    });
  }
  // Después del partido (D18): al jugador, el resultado de los últimos 3 días; si fue la
  // figura, la felicitación va arriba.
  if (player) {
    const recent = now.getTime() - 3 * 86_400_000;
    for (const m of matches) {
      if (!m.result || new Date(m.result.at).getTime() < recent) continue;
      const score = `${m.result.goalsFor} a ${m.result.goalsAgainst}`;
      const figure = meId !== undefined && m.result.figure?.id === meId;
      todos.push({
        id: `match-played-${m.id}`,
        priority: figure ? 1 : 7,
        who: 'player',
        icon: 'match',
        title: figure ? `¡Fuiste la figura contra ${m.opponent}!` : `${m.opponent}: ${score}`,
        detail: figure
          ? `${score}. Felicitaciones.`
          : m.myRating !== null
            ? 'Mira cómo jugaste.'
            : 'Ya está el resultado.',
        to: `/equipos/${teamId}/partidos/${m.id}`,
      });
    }
  }
  // Después del partido (D18): al cuerpo técnico, los de la última semana sin resultado.
  if (staff) {
    const weekAgo = now.getTime() - 7 * 86_400_000;
    for (const m of matches) {
      const started = new Date(m.startsAt).getTime();
      if (m.status !== 'scheduled' || m.open || m.result || started < weekAgo) continue;
      todos.push({
        id: `match-result-${m.id}`,
        priority: 2,
        who: 'staff',
        icon: 'match',
        title: `¿Cómo salió contra ${m.opponent}?`,
        detail: 'Carga el resultado y evalúa a los que jugaron.',
        short: `${m.opponent}, sin resultado`,
        to: `/equipos/${teamId}/partidos/${m.id}`,
      });
    }
  }
  return todos;
}
