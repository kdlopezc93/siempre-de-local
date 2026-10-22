import type { PositionCode } from '../positions.js';

/** Versión del encaje jugador–posición (02 §9); se guarda con cada alineación. */
export const FIT_VERSION = 'fit-v1';

export type Signal = 'A' | 'V' | 'C' | 'R';
export type Weights = Readonly<Record<Signal, number>>;
export type FitMode = 'balanced' | 'performance' | 'development';

/** Pesos iniciales de cada modo (02 §9.2). */
export const MODE_WEIGHTS: Readonly<Record<FitMode, Weights>> = {
  balanced: { A: 0.15, V: 0.3, C: 0.2, R: 0.35 },
  performance: { A: 0.05, V: 0.3, C: 0.15, R: 0.5 },
  development: { A: 0.35, V: 0.2, C: 0.25, R: 0.2 },
};

export const MODE_LABELS: Readonly<Record<FitMode, string>> = {
  balanced: 'Equilibrado',
  performance: 'Rendimiento',
  development: 'Desarrollo',
};

/**
 * Lo que se sabe de un jugador. Cada señal es opcional: lo que falta se excluye y se
 * renormaliza, salvo el conocimiento, que si falta vale 0 (no haber presentado es
 * información, 02 §9.1).
 */
export interface PlayerSignals {
  playerId: string;
  /** Afinidad 0–1 del último test por posición (ya plegada en F8). Sin test, o test oculto: ausente. */
  affinity?: Partial<Record<PositionCode, number>>;
  /** Última valoración del cuerpo técnico. */
  assessment?: { primary: PositionCode; secondary: readonly PositionCode[] };
  /** Mejor puntaje de conocimiento por posición (0–1) y si tiene una re-evaluación vencida. */
  knowledge?: Partial<Record<PositionCode, { pct: number; reviewExpired: boolean }>>;
  /** Media por posición de la tarjeta (0–99). */
  rating?: Partial<Record<PositionCode, number>>;
}

export type Breakdown = Partial<Record<Signal, number>>;

/** Conocimiento corregido por azar: con 4 opciones el azar da 25%, que pasa a valer 0. */
export function knowledgeSignal(pct: number): number {
  return Math.max(0, (pct - 0.25) / 0.75);
}

/** Valores 0–1 de cada señal disponible para (jugador, posición). */
export function signalsFor(player: PlayerSignals, position: PositionCode): Breakdown {
  const out: Breakdown = {};
  const a = player.affinity?.[position];
  if (a !== undefined) out.A = a;
  if (player.assessment) {
    out.V =
      player.assessment.primary === position
        ? 1
        : player.assessment.secondary.includes(position)
          ? 0.6
          : 0;
  }
  const k = player.knowledge?.[position];
  // Sin examen, o con una re-evaluación vencida sin presentar: 0.
  out.C = k && !k.reviewExpired ? knowledgeSignal(k.pct) : 0;
  const r = player.rating?.[position];
  if (r !== undefined) out.R = r / 99;
  return out;
}

/** Sin test, valoración ni tarjeta: solo tiene (o no) conocimiento. Va al final. */
export function hasNoData(player: PlayerSignals): boolean {
  return !player.affinity && !player.assessment && !player.rating;
}

/** Encaje 0–1 = Σ wᵢ·sᵢ / Σ wᵢ sobre las señales disponibles (02 §9.1). */
export function fit(
  player: PlayerSignals,
  position: PositionCode,
  weights: Weights,
): { fit: number; breakdown: Breakdown } {
  const breakdown = signalsFor(player, position);
  let num = 0;
  let den = 0;
  for (const [signal, value] of Object.entries(breakdown) as [Signal, number][]) {
    num += weights[signal] * value;
    den += weights[signal];
  }
  return { fit: den === 0 ? 0 : num / den, breakdown };
}
