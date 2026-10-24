import type { PositionCode } from './positions.js';

/**
 * Examen de conocimiento por posición (02 §6). Reglas puras: qué ítems salen, cómo se
 * puntúa, qué puntaje cuenta y cuándo se puede volver a presentar.
 */

export type Difficulty = 1 | 2 | 3;
export type KnowledgeBand = 'mastery' | 'solid' | 'developing' | 'insufficient';

export interface ExamConfig {
  itemsPerExam: number;
  /** Proporción por dificultad; suma 1. */
  difficultyMix: Readonly<Record<Difficulty, number>>;
  attemptIntervalDays: number;
  timeLimitSeconds: number;
  minItemsToPublish: number;
}

/** Valores iniciales (02 §6.3); cada versión del banco puede cambiarlos. */
export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  itemsPerExam: 20,
  difficultyMix: { 1: 0.3, 2: 0.5, 3: 0.2 },
  attemptIntervalDays: 30,
  timeLimitSeconds: 20 * 60,
  minItemsToPublish: 40,
};

/** Lo que la selección necesita de cada ítem del banco. */
export interface BankItem {
  id: string;
  area: string;
  difficulty: Difficulty;
  /** Pregunta de pizarra (`pitch_situation`). */
  board?: boolean;
}

/** Cuántos ítems de cada dificultad: redondeo que reparte el sobrante a las de más peso. */
export function difficultyQuotas(cfg: ExamConfig): Record<Difficulty, number> {
  const levels = [1, 2, 3] as const;
  const exact = levels.map((d) => cfg.difficultyMix[d] * cfg.itemsPerExam);
  const quotas = exact.map(Math.floor);
  let left = cfg.itemsPerExam - quotas.reduce((a, b) => a + b, 0);
  const byRemainder = levels
    .map((_, i) => i)
    .sort((a, b) => exact[b]! - quotas[b]! - (exact[a]! - quotas[a]!) || b - a);
  for (const i of byRemainder) {
    if (left-- <= 0) break;
    quotas[i]!++;
  }
  return { 1: quotas[0]!, 2: quotas[1]!, 3: quotas[2]! };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Elige los ítems de un examen (02 §6.3):
 * 1. **No vistos primero:** solo se repiten ítems ya vistos si no alcanzan los nuevos.
 * 2. **Todas las áreas:** al menos uno de cada área (si el examen da para tantas).
 * 3. **Mezcla de dificultad** según `difficultyMix`; si una dificultad no alcanza, se
 *    completa con las otras.
 * 4. **Al menos una de pizarra** si el banco las tiene (Fase 8): va primero y cuenta como la
 *    de su área. Si el jugador ya las vio todas, se repite una antes que dejar el examen sin
 *    pizarra.
 * Devuelve los ítems en orden aleatorio.
 */
export function selectExamItems<T extends BankItem>(
  bank: readonly T[],
  seenItemIds: ReadonlySet<string>,
  cfg: ExamConfig,
  rng: () => number,
): T[] {
  const n = Math.min(cfg.itemsPerExam, bank.length);
  // Orden de preferencia: no vistos (al azar) y después vistos (al azar).
  const ranked = [
    ...shuffle(
      bank.filter((item) => !seenItemIds.has(item.id)),
      rng,
    ),
    ...shuffle(
      bank.filter((item) => seenItemIds.has(item.id)),
      rng,
    ),
  ];
  const unseen = (item: T) => !seenItemIds.has(item.id);
  const quotas = difficultyQuotas({ ...cfg, itemsPerExam: n });
  const chosen: T[] = [];
  const taken = new Set<string>();
  const take = (item: T) => {
    chosen.push(item);
    taken.add(item.id);
    quotas[item.difficulty]--;
  };

  // 0. Una de pizarra, si hay: no vista y con cupo de dificultad, si se puede.
  const boards = ranked.filter((item) => item.board);
  const board =
    boards.find((item) => unseen(item) && quotas[item.difficulty] > 0) ??
    boards.find(unseen) ??
    boards[0];
  if (board && n > 0) take(board);

  // 1. Un ítem por área, prefiriendo no vistos y dificultades con cupo.
  const areas = shuffle([...new Set(bank.map((item) => item.area))], rng).slice(0, n);
  for (const area of areas) {
    if (chosen.length >= n) break;
    if (chosen.some((item) => item.area === area)) continue;
    const candidates = ranked.filter((item) => item.area === area);
    const pick =
      candidates.find((item) => unseen(item) && quotas[item.difficulty] > 0) ??
      candidates.find(unseen) ??
      candidates.find((item) => quotas[item.difficulty] > 0) ??
      candidates[0];
    if (pick) take(pick);
  }

  // 2. Completar los cupos por dificultad, no vistos primero.
  for (const pass of [unseen, () => true] as const) {
    for (const item of ranked) {
      if (chosen.length >= n) break;
      if (!taken.has(item.id) && pass(item) && quotas[item.difficulty] > 0) take(item);
    }
  }
  // 3. Si alguna dificultad no alcanzó, se completa con lo que haya.
  for (const pass of [unseen, () => true] as const) {
    for (const item of ranked) {
      if (chosen.length >= n) break;
      if (!taken.has(item.id) && pass(item)) take(item);
    }
  }
  return shuffle(chosen, rng);
}

export function bandFor(pct: number): KnowledgeBand {
  if (pct >= 0.85) return 'mastery';
  if (pct >= 0.7) return 'solid';
  if (pct >= 0.5) return 'developing';
  return 'insufficient';
}

export const BAND_LABELS: Readonly<Record<KnowledgeBand, string>> = {
  mastery: 'Dominio',
  solid: 'Sólido',
  developing: 'En desarrollo',
  insufficient: 'Insuficiente',
};

/**
 * La mejor banda de un jugador (la de su mejor puntaje), para que la vean sus compañeros (D11:
 * la banda y la posición, nunca el puntaje). "Insuficiente" no se muestra a los compañeros.
 */
export function bestBandForTeammates<P extends string>(
  knowledge: readonly { position: P; pct: number | null }[],
): { position: P; band: Exclude<KnowledgeBand, 'insufficient'> } | null {
  let best: { position: P; pct: number } | null = null;
  for (const k of knowledge) {
    if (k.pct !== null && (!best || k.pct > best.pct)) best = { position: k.position, pct: k.pct };
  }
  if (!best) return null;
  const band = bandFor(best.pct);
  return band === 'insufficient' ? null : { position: best.position, band };
}

export interface ExamResult {
  score: number;
  total: number;
  pct: number;
  band: KnowledgeBand;
  /** Aciertos por área, en el orden en que aparecen en el examen. */
  byArea: { area: string; correct: number; total: number }[];
}

/**
 * Puntúa un examen. Lo no respondido (tiempo agotado o abandono) cuenta como fallo
 * (02 §6.3). `pct` se redondea a 3 decimales, como se guarda.
 */
export function scoreExam(
  items: readonly { id: string; area: string; correctOptionId: string }[],
  answers: ReadonlyMap<string, string | null>,
): ExamResult {
  const byArea = new Map<string, { correct: number; total: number }>();
  let score = 0;
  for (const item of items) {
    const right = answers.get(item.id) === item.correctOptionId;
    if (right) score++;
    const area = byArea.get(item.area) ?? { correct: 0, total: 0 };
    area.total++;
    if (right) area.correct++;
    byArea.set(item.area, area);
  }
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((score / total) * 1000) / 1000;
  return {
    score,
    total,
    pct,
    band: bandFor(pct),
    byArea: [...byArea].map(([area, counts]) => ({ area, ...counts })),
  };
}

/** Un intento ya cerrado o en curso, tal como lo necesitan las reglas de abajo. */
export interface ExamSummary {
  id: string;
  position: PositionCode;
  status: 'in_progress' | 'submitted' | 'expired' | 'void';
  pct: number | null;
  startedAt: Date;
  submittedAt: Date | null;
  /** Fijado al iniciar: `startedAt + attemptIntervalDays`. */
  nextAttemptAt: Date;
  /** Puntaje "a revisar" (banco retirado por calidad): permite repetir sin esperar. */
  underReview: boolean;
  /** Marcado por una re-evaluación completada: ya no cuenta. */
  superseded: boolean;
  /** Anulado con permiso para repetir sin esperar el mes. */
  voidResetsInterval: boolean;
}

/**
 * El puntaje de conocimiento de una posición: el **mejor** intento válido (no caduca,
 * 02 §6.3). Ignora anulados, vencidos sin entregar y sustituidos. Empate: el más reciente.
 */
export function bestKnowledge(
  exams: readonly ExamSummary[],
  position: PositionCode,
): { examId: string; pct: number; band: KnowledgeBand; underReview: boolean } | null {
  const best = exams
    .filter(
      (e) => e.position === position && e.status === 'submitted' && !e.superseded && e.pct !== null,
    )
    .sort(
      (a, b) =>
        b.pct! - a.pct! || (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0),
    )[0];
  return best
    ? { examId: best.id, pct: best.pct!, band: bandFor(best.pct!), underReview: best.underReview }
    : null;
}

export type StartCheck =
  | { ok: true }
  | { ok: false; reason: 'EXAM_IN_PROGRESS'; examId: string }
  | { ok: false; reason: 'ATTEMPT_INTERVAL'; nextAttemptAt: Date };

/**
 * ¿Puede empezar un examen de esa posición ahora? (02 §6.3, §6.6, §6.7)
 * - Un examen activo a la vez (de cualquier posición).
 * - Un intento por posición cada N días, desde el **inicio** del último, cuente como cuente.
 * - Sin espera si el último está "a revisar", si se anuló con reinicio o si hay una
 *   re-evaluación pendiente de esa posición. Los reemplazados no cuentan.
 */
export function canStartExam(
  exams: readonly ExamSummary[],
  position: PositionCode,
  now: Date,
  opts: { pendingReview: boolean },
): StartCheck {
  const active = exams.find((e) => e.status === 'in_progress');
  if (active) return { ok: false, reason: 'EXAM_IN_PROGRESS', examId: active.id };
  if (opts.pendingReview) return { ok: true };
  // Un reemplazado no marca la espera: la re-evaluación que lo reemplazó ya la saltó, y
  // si esa también se anula con reinicio, no queda nada que esperar.
  const last = exams
    .filter(
      (e) =>
        e.position === position && !e.superseded && !(e.status === 'void' && e.voidResetsInterval),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  if (!last || last.underReview || now >= last.nextAttemptAt) return { ok: true };
  return { ok: false, reason: 'ATTEMPT_INTERVAL', nextAttemptAt: last.nextAttemptAt };
}

export function nextAttemptFrom(startedAt: Date, cfg: Pick<ExamConfig, 'attemptIntervalDays'>) {
  return new Date(startedAt.getTime() + cfg.attemptIntervalDays * 24 * 60 * 60 * 1000);
}
