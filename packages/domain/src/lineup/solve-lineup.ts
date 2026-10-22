import { assign } from './hungarian.js';
import { fit, hasNoData, type Breakdown, type PlayerSignals, type Weights } from './fit.js';
import { LINE_OF, type Formation } from './formations.js';

export type LinePriority = 'none' | 'defensa' | 'ataque';

export interface LineupRequest {
  formation: Formation;
  /** Los convocados. */
  players: readonly PlayerSignals[];
  weights: Weights;
  /** Jugadores que el entrenador fija en un puesto antes de resolver. */
  pins?: readonly { slotId: string; playerId: string }[];
  /** Umbral de conocimiento (0–1) para jugar en una posición; null = apagado. */
  minKnowledgePct?: number | null;
  /** Qué línea se arma primero con toda la plantilla (como el prototipo). */
  priority?: LinePriority;
}

export interface SlotAssignment {
  slotId: string;
  playerId: string | null;
  fit: number | null;
  breakdown: Breakdown | null;
  pinned: boolean;
}

export type LineupWarning =
  | { code: 'MIN_KNOWLEDGE_INFEASIBLE'; slotId: string }
  | { code: 'NOT_ENOUGH_PLAYERS'; missing: number }
  | { code: 'PLAYER_WITHOUT_DATA'; playerId: string }
  | { code: 'KNOWLEDGE_REVIEW_EXPIRED'; playerId: string; slotId: string };

export interface LineupResult {
  assignments: SlotAssignment[];
  /** Suplentes, del que mejor encaja en algún puesto al que menos. */
  bench: string[];
  warnings: LineupWarning[];
}

/** Costo para quien no supera el conocimiento mínimo: evita el puesto si hay alternativa. */
const FORBIDDEN = 1_000;
/** Un jugador sin datos va después que cualquiera con datos. */
const NO_DATA = 10;

/**
 * Arma la alineación (02 §9.3): fijados primero; después el húngaro sobre el resto, en
 * una pasada o, si se prioriza una línea, esa línea primero con toda la plantilla
 * disponible (como el planificador del prototipo). Si el conocimiento mínimo deja un
 * puesto sin candidato válido, se avisa y se usa al mejor igual.
 */
export function solveLineup(req: LineupRequest): LineupResult {
  const { formation, weights } = req;
  const pins = req.pins ?? [];
  const priority = req.priority ?? 'none';
  const byId = new Map(req.players.map((p) => [p.playerId, p]));
  const warnings: LineupWarning[] = [];
  const result = new Map<string, SlotAssignment>();

  const evaluate = (player: PlayerSignals, slotId: string) => {
    const slot = formation.slots.find((s) => s.id === slotId)!;
    return fit(player, slot.position, weights);
  };

  for (const pin of pins) {
    const player = byId.get(pin.playerId);
    if (!player || !formation.slots.some((s) => s.id === pin.slotId)) continue;
    const { fit: f, breakdown } = evaluate(player, pin.slotId);
    result.set(pin.slotId, {
      slotId: pin.slotId,
      playerId: player.playerId,
      fit: f,
      breakdown,
      pinned: true,
    });
  }
  let pool = req.players.filter(
    (p) => ![...result.values()].some((a) => a.playerId === p.playerId),
  );

  const cost = (player: PlayerSignals, slotId: string) => {
    const position = formation.slots.find((s) => s.id === slotId)!.position;
    let c = 1 - evaluate(player, slotId).fit;
    if (hasNoData(player)) c += NO_DATA;
    const min = req.minKnowledgePct;
    if (min != null && (player.knowledge?.[position]?.pct ?? 0) < min) c += FORBIDDEN;
    return c;
  };

  const solveGroup = (slotIds: string[]) => {
    if (slotIds.length === 0 || pool.length === 0) return;
    const matrix = pool.map((p) => slotIds.map((s) => cost(p, s)));
    const colOfRow = assign(matrix);
    const used = new Set<string>();
    colOfRow.forEach((col, row) => {
      if (col === -1) return;
      const player = pool[row]!;
      const slotId = slotIds[col]!;
      const { fit: f, breakdown } = evaluate(player, slotId);
      result.set(slotId, { slotId, playerId: player.playerId, fit: f, breakdown, pinned: false });
      used.add(player.playerId);
      if (matrix[row]![col]! >= FORBIDDEN)
        warnings.push({ code: 'MIN_KNOWLEDGE_INFEASIBLE', slotId });
    });
    pool = pool.filter((p) => !used.has(p.playerId));
  };

  const open = () => formation.slots.filter((s) => !result.has(s.id)).map((s) => s.id);
  if (priority !== 'none') {
    solveGroup(
      open().filter(
        (id) => LINE_OF[formation.slots.find((s) => s.id === id)!.position] === priority,
      ),
    );
  }
  solveGroup(open());

  const assignments = formation.slots.map(
    (s) =>
      result.get(s.id) ?? {
        slotId: s.id,
        playerId: null,
        fit: null,
        breakdown: null,
        pinned: false,
      },
  );
  const missing = assignments.filter((a) => !a.playerId).length;
  if (missing > 0) warnings.push({ code: 'NOT_ENOUGH_PLAYERS', missing });
  for (const a of assignments) {
    if (!a.playerId) continue;
    const player = byId.get(a.playerId)!;
    if (hasNoData(player)) warnings.push({ code: 'PLAYER_WITHOUT_DATA', playerId: a.playerId });
    const position = formation.slots.find((s) => s.id === a.slotId)!.position;
    if (player.knowledge?.[position]?.reviewExpired) {
      warnings.push({ code: 'KNOWLEDGE_REVIEW_EXPIRED', playerId: a.playerId, slotId: a.slotId });
    }
  }

  const bestFit = (p: PlayerSignals) =>
    Math.max(...formation.slots.map((s) => evaluate(p, s.id).fit)) - (hasNoData(p) ? NO_DATA : 0);
  const bench = [...pool].sort((a, b) => bestFit(b) - bestFit(a)).map((p) => p.playerId);
  return { assignments, bench, warnings };
}

/** Encaje medio de cada línea (0–100), para el resumen del equipo (como el prototipo). */
export function lineRatings(
  formation: Formation,
  assignments: readonly SlotAssignment[],
): Record<'defensa' | 'medio' | 'ataque', number | null> {
  const acc = { defensa: [] as number[], medio: [] as number[], ataque: [] as number[] };
  for (const a of assignments) {
    if (a.fit === null) continue;
    acc[LINE_OF[formation.slots.find((s) => s.id === a.slotId)!.position]].push(a.fit);
  }
  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) : null;
  return { defensa: avg(acc.defensa), medio: avg(acc.medio), ataque: avg(acc.ataque) };
}
