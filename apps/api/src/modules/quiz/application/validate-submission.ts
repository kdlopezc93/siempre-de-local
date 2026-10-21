import type { SubmitAttemptRequest } from '@sdl/contracts';
import type { ServedPositionItem } from '@sdl/domain';

import { BusinessRuleError } from '../../../shared/errors/application-errors.js';
import type { QuestionnaireContent } from '../../questionnaires/application/ports/questionnaire.reader.js';

/** Margen para relojes de celular adelantados. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const invalid = (message: string) => new BusinessRuleError(message, 'ATTEMPT_INVALID');

type Served = SubmitAttemptRequest['positionItems'][number];

/** Mismo conjunto de ids, sin repetidos. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return set.size === a.length && a.length === b.length && b.every((id) => set.has(id));
}

/** Cada ítem servido: existe, sin repetir, orden 1..n, opciones = las suyas y respuesta suya. */
function checkServed<T extends { id: string; options: { id: string }[] }>(
  served: readonly Served[],
  byId: ReadonlyMap<string, T>,
  phase: string,
): T[] {
  const seen = new Set<string>();
  const orders = served.map((s) => s.shownOrder).sort((a, b) => a - b);
  if (orders.some((order, i) => order !== i + 1)) {
    throw invalid(`${phase}: el orden mostrado debe ir de 1 a ${served.length}`);
  }
  return [...served]
    .sort((a, b) => a.shownOrder - b.shownOrder)
    .map((s) => {
      const item = byId.get(s.itemId);
      if (!item || seen.has(s.itemId))
        throw invalid(`${phase}: ítem ${s.itemId} inválido o repetido`);
      seen.add(s.itemId);
      const optionIds = item.options.map((o) => o.id);
      if (!sameSet(s.optionOrder, optionIds))
        throw invalid(`${phase}: opciones de ${s.itemId} no cuadran`);
      if (!optionIds.includes(s.answerOptionId))
        throw invalid(`${phase}: respuesta fuera del ítem ${s.itemId}`);
      return item;
    });
}

export function checkTimes(request: SubmitAttemptRequest, now: Date): void {
  const started = Date.parse(request.startedAt);
  const submitted = Date.parse(request.submittedAt);
  if (started > submitted || submitted > now.getTime() + CLOCK_SKEW_MS) {
    throw invalid('Las fechas del intento no son válidas');
  }
}

/** Ítems en el orden mostrado, listos para `scorePosition` (02 §3). */
export function positionPart(
  content: QuestionnaireContent,
  request: SubmitAttemptRequest,
): { items: ServedPositionItem[]; answers: string[] } {
  if (request.positionItems.length !== content.positionItemsPerAttempt) {
    throw invalid(`Se esperaban ${content.positionItemsPerAttempt} preguntas de posición`);
  }
  const byId = new Map(content.positionItems.map((item) => [item.id, item]));
  const items = checkServed(request.positionItems, byId, 'Pregunta');
  const ordered = [...request.positionItems].sort((a, b) => a.shownOrder - b.shownOrder);
  return {
    items: items.map((item) => ({
      id: item.id,
      options: item.options.map((o) => ({ id: o.id, points: o.points })),
    })),
    answers: ordered.map((s) => s.answerOptionId),
  };
}
