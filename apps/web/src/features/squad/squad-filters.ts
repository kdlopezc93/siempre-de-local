import type { MatchFormat, PositionCode, SquadPlayer } from '@sdl/contracts';
import { positionName } from '@sdl/domain';

import { lineOfPosition, type TokenLine } from '../../shared/ui/Token';
import { cardHeadline } from '../card/card-view';
import { positionOf } from './distribution';

/** Filtros de la plantilla. Viven en la URL (`?filtro=por-valorar,defensa`). */
export type StatusFilter = 'por-valorar' | 're-evaluacion' | 'sin-tarjeta' | 'sin-test';
export type SquadFilter = StatusFilter | TokenLine;

export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'por-valorar', label: 'Por valorar' },
  { value: 're-evaluacion', label: 'Re-evaluación vencida' },
  { value: 'sin-tarjeta', label: 'Sin tarjeta' },
  { value: 'sin-test', label: 'Sin test' },
];

export const LINE_FILTERS: { value: TokenLine; label: string }[] = [
  { value: 'portero', label: 'Porteros' },
  { value: 'defensa', label: 'Defensas' },
  { value: 'medio', label: 'Medios' },
  { value: 'ataque', label: 'Delanteros' },
];

const KNOWN = new Set<string>([...STATUS_FILTERS, ...LINE_FILTERS].map((f) => f.value));

/** Lee `?filtro=` ignorando lo que no se conoce (un enlace viejo no rompe nada). */
export function parseFilters(raw: string | null): Set<SquadFilter> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter((v): v is SquadFilter => KNOWN.has(v)),
  );
}

export const serializeFilters = (filters: ReadonlySet<SquadFilter>) => [...filters].join(',');

const STATUS: Record<StatusFilter, (p: SquadPlayer) => boolean> = {
  'por-valorar': (p) => p.canRate && !p.assessedByMe,
  're-evaluacion': (p) => p.knowledge.some((k) => k.review === 'expired'),
  'sin-tarjeta': (p) => !p.card,
  'sin-test': (p) => p.test.status === 'none',
};

/**
 * La posición con la que se muestra a cada jugador: lo que dijo el cuerpo técnico; si no, su
 * test (si ya se ve); si no, la que prefiere.
 */
export function shownPosition(player: SquadPlayer): PositionCode | null {
  return (
    positionOf(player, 'staff') ?? positionOf(player, 'test') ?? positionOf(player, 'preferred')
  );
}

export function lineOf(player: SquadPlayer): TokenLine | null {
  const pos = shownPosition(player);
  return pos ? lineOfPosition(pos) : null;
}

/** La media que encabeza su tarjeta en el formato del equipo (02 §7.4), o null sin tarjeta. */
export function cardAverage(player: SquadPlayer, format: MatchFormat): number | null {
  return player.card ? (cardHeadline(player.card, format)?.main.value ?? null) : null;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Busca por nombre (sin importar tildes) o dorsal exacto. Los filtros de un mismo grupo
 * suman ("defensas o medios"); entre grupos, se cruzan ("por valorar y defensas").
 */
export function filterSquad(
  players: readonly SquadPlayer[],
  query: string,
  filters: ReadonlySet<SquadFilter>,
): SquadPlayer[] {
  const q = fold(query.trim());
  const statuses = STATUS_FILTERS.filter((f) => filters.has(f.value)).map((f) => STATUS[f.value]);
  const lines = LINE_FILTERS.filter((f) => filters.has(f.value)).map((f) => f.value);
  return players
    .filter(
      (p) =>
        (!q || fold(p.displayName).includes(q) || String(p.jerseyNumber) === q) &&
        (statuses.length === 0 || statuses.some((test) => test(p))) &&
        (lines.length === 0 || lines.includes(lineOf(p)!)),
    )
    .sort(
      (a, b) =>
        (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
        a.displayName.localeCompare(b.displayName, 'es'),
    );
}

/** Cuántos tiene cada filtro, para mostrarlo en el botón. */
export function filterCounts(players: readonly SquadPlayer[]): Record<SquadFilter, number> {
  const counts = Object.fromEntries(
    [...STATUS_FILTERS, ...LINE_FILTERS].map((f) => [f.value, 0]),
  ) as Record<SquadFilter, number>;
  for (const p of players) {
    for (const f of STATUS_FILTERS) if (STATUS[f.value](p)) counts[f.value]++;
    const line = lineOf(p);
    if (line) counts[line]++;
  }
  return counts;
}

/** "Defensa central" o, sin dato, "Sin posición". */
export const positionLabel = (player: SquadPlayer, format?: MatchFormat) => {
  const pos = shownPosition(player);
  return pos ? positionName(pos, format) : 'Sin posición';
};
