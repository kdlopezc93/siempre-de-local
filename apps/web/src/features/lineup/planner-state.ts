import type { Lineup, LineupInput, Match, MatchFormat, MatchReply } from '@sdl/contracts';
import {
  DEFAULT_FORMATION,
  FIT_VERSION,
  MODE_WEIGHTS,
  type FitMode,
  type LinePriority,
  type LineupResult,
} from '@sdl/domain';

/**
 * Lo que el entrenador decide en el planificador. La alineación se recalcula siempre a
 * partir de esto; lo que ubica a mano queda **fijado**, así el cálculo nunca le pisa un
 * cambio y el resto se reacomoda alrededor.
 */
export interface PlannerState {
  /** El del partido: un equipo de F11 puede jugar un torneo de F8. */
  format: MatchFormat;
  formationKey: string;
  mode: FitMode;
  priority: LinePriority;
  minKnowledgePct: number | null;
  /** Convocados. */
  available: ReadonlySet<string>;
  /** Mandados a la banca a mano: no entran al cálculo. */
  benched: ReadonlySet<string>;
  pins: readonly { slotId: string; playerId: string }[];
  /** Lo tocado: un puesto o un suplente, a la espera del segundo toque. */
  selected: { kind: 'slot'; slotId: string } | { kind: 'bench'; playerId: string } | null;
}

export function initialState(format: MatchFormat, playerIds: readonly string[]): PlannerState {
  return {
    format,
    formationKey: DEFAULT_FORMATION[format],
    mode: 'balanced',
    priority: 'none',
    minKnowledgePct: null,
    available: new Set(playerIds),
    benched: new Set(),
    pins: [],
    selected: null,
  };
}

const without = (pins: PlannerState['pins'], slotIds: string[], playerIds: string[]) =>
  pins.filter((p) => !slotIds.includes(p.slotId) && !playerIds.includes(p.playerId));

/** Cambiar el formato del partido: su formación por defecto y nada fijado. */
export function setFormat(state: PlannerState, format: MatchFormat): PlannerState {
  if (format === state.format) return state;
  return { ...state, format, formationKey: DEFAULT_FORMATION[format], pins: [], selected: null };
}

/** Cambiar de formación: los puestos son otros, así que se sueltan los fijados. */
export function setFormation(state: PlannerState, formationKey: string): PlannerState {
  return { ...state, formationKey, pins: [], selected: null };
}

export function toggleAvailable(state: PlannerState, playerId: string): PlannerState {
  const available = new Set(state.available);
  const benched = new Set(state.benched);
  if (available.has(playerId)) {
    available.delete(playerId);
    benched.delete(playerId);
  } else available.add(playerId);
  return {
    ...state,
    available,
    benched,
    pins: without(state.pins, [], [playerId]),
    selected: null,
  };
}

export function setAllAvailable(state: PlannerState, playerIds: readonly string[]): PlannerState {
  return { ...state, available: new Set(playerIds), selected: null };
}

/**
 * Tocar un puesto. Con un suplente elegido, entra ahí (y queda fijado). Con otro puesto
 * elegido, se intercambian (los dos quedan fijados). Si no, se elige este puesto.
 * `occupant` dice quién está hoy en cada puesto.
 */
export function tapSlot(
  state: PlannerState,
  slotId: string,
  occupant: (slotId: string) => string | null,
): PlannerState {
  const sel = state.selected;
  if (sel?.kind === 'bench') {
    const benched = new Set(state.benched);
    benched.delete(sel.playerId);
    return {
      ...state,
      benched,
      pins: [...without(state.pins, [slotId], [sel.playerId]), { slotId, playerId: sel.playerId }],
      selected: null,
    };
  }
  if (sel?.kind === 'slot') {
    if (sel.slotId === slotId) return { ...state, selected: null };
    const a = occupant(sel.slotId);
    const b = occupant(slotId);
    const pins = without(
      state.pins,
      [sel.slotId, slotId],
      [a, b].filter((x) => x !== null),
    );
    if (a) pins.push({ slotId, playerId: a });
    if (b) pins.push({ slotId: sel.slotId, playerId: b });
    return { ...state, pins, selected: null };
  }
  return { ...state, selected: { kind: 'slot', slotId } };
}

export function tapBench(state: PlannerState, playerId: string): PlannerState {
  const same = state.selected?.kind === 'bench' && state.selected.playerId === playerId;
  return { ...state, selected: same ? null : { kind: 'bench', playerId } };
}

/** Soltar: vuelve al cálculo. */
export function unpin(state: PlannerState, slotId: string): PlannerState {
  return { ...state, pins: without(state.pins, [slotId], []), selected: null };
}

/** Mandar a la banca: sale de la cancha y no vuelve a entrar sola. */
export function sendToBench(state: PlannerState, playerId: string): PlannerState {
  return {
    ...state,
    benched: new Set([...state.benched, playerId]),
    pins: without(state.pins, [], [playerId]),
    selected: null,
  };
}

/**
 * Abrir una alineación guardada para editarla: tal cual se guardó, con todos fijados (así
 * nada se mueve solo aunque hayan cambiado tarjetas o exámenes). Quien ya no está en el
 * equipo queda fuera.
 */
export function fromLineup(lineup: Lineup, currentPlayerIds: readonly string[]): PlannerState {
  const here = new Set(currentPlayerIds);
  return {
    format: lineup.format,
    formationKey: lineup.formation,
    mode: lineup.mode,
    priority: lineup.priority,
    minKnowledgePct: lineup.minKnowledgePct,
    available: new Set(lineup.available.filter((id) => here.has(id))),
    benched: new Set(lineup.bench.filter((id) => here.has(id))),
    pins: lineup.assignments.flatMap((a) =>
      a.playerId && here.has(a.playerId) ? [{ slotId: a.slotId, playerId: a.playerId }] : [],
    ),
    selected: null,
  };
}

/** Lo armado, listo para guardar: la foto completa del cálculo y de lo tocado a mano. */
export function toLineupInput(
  state: PlannerState,
  result: LineupResult,
  details: { name: string; matchDate: string | null; matchId?: string | null },
): LineupInput {
  const pinned = new Set(state.pins.map((p) => p.slotId));
  return {
    name: details.name.trim(),
    matchDate: details.matchDate,
    matchId: details.matchId ?? null,
    formation: state.formationKey,
    mode: state.mode,
    weights: { ...MODE_WEIGHTS[state.mode] },
    priority: state.priority,
    minKnowledgePct: state.minKnowledgePct,
    fitVersion: FIT_VERSION,
    available: [...state.available],
    pins: [...state.pins],
    assignments: result.assignments.map((a) => ({
      slotId: a.slotId,
      playerId: a.playerId,
      fit: a.fit,
      breakdown: a.breakdown,
      pinned: a.pinned,
      manual: pinned.has(a.slotId),
    })),
    bench: result.bench,
  };
}

/**
 * Abrir el planificador desde un partido (Fase 7): su formato y, convocados, los que dijeron
 * voy. Los que no respondieron quedan fuera, a la vista para sumarlos a mano.
 */
export function fromMatch(
  match: Pick<Match, 'format'>,
  roster: readonly { playerId: string; reply: MatchReply | null }[] | null,
  currentPlayerIds: readonly string[],
): PlannerState {
  const yes = roster
    ? new Set(roster.filter((p) => p.reply === 'yes').map((p) => p.playerId))
    : null;
  return initialState(
    match.format,
    currentPlayerIds.filter((id) => !yes || yes.has(id)),
  );
}
