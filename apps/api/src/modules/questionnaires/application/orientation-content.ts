import { isPositionCode, POSITION_CODES, type PositionCode } from '@sdl/domain';

/** Contenido de una versión del test de orientación antes de guardarla (02 §2, 03 §5). */
export interface OrientationContent {
  label: string;
  positionItemsPerAttempt: number;
  positionItems: {
    code: string;
    context: 'situation' | 'attribute';
    text: string;
    options: { label: string; points: Partial<Record<PositionCode, number>> }[];
  }[];
  /**
   * Solo v1 (histórico): 8 de preparación por posición. Desde v2 el test es solo de posición
   * y el conocimiento se mide con el examen de certificación (02 §5).
   */
  prepItems: Partial<
    Record<PositionCode, { text: string; options: { label: string; isCorrect: boolean }[] }[]>
  >;
  /**
   * Desde v3, quién revisó las preguntas y cuándo (Fase 8): `null` es un borrador y no se
   * publica. v1 y v2 no lo traen (vienen del prototipo).
   */
  review?: { reviewedBy: string; reviewedOn: string } | null;
}

/** Reglas que se comprueban al publicar una versión. Devuelve los problemas encontrados. */
export function validateOrientationContent(content: OrientationContent): string[] {
  const problems: string[] = [];
  const { positionItems, prepItems, positionItemsPerAttempt } = content;

  if (positionItems.length < positionItemsPerAttempt) {
    problems.push(
      `Hay ${positionItems.length} ítems de posición y cada intento sirve ${positionItemsPerAttempt}`,
    );
  }
  if (content.review === null) {
    problems.push('Es un borrador: falta la revisión (review) antes de publicarla');
  }
  const codes = new Set(positionItems.map((item) => item.code));
  if (codes.size !== positionItems.length) problems.push('Hay códigos de ítem repetidos');

  for (const item of positionItems) {
    if (item.options.length < 2) problems.push(`${item.code}: necesita al menos 2 opciones`);
    for (const option of item.options) {
      const entries = Object.entries(option.points);
      if (entries.length === 0) problems.push(`${item.code}: una opción no reparte puntos`);
      for (const [pos, points] of entries) {
        if (!isPositionCode(pos)) problems.push(`${item.code}: posición desconocida ${pos}`);
        if (!Number.isInteger(points) || points <= 0) {
          problems.push(`${item.code}: puntos inválidos para ${pos}`);
        }
      }
    }
  }

  // La preparación es opcional (v1); si viene, cada posición la trae completa y bien formada.
  const withPrep = POSITION_CODES.filter((pos) => (prepItems[pos]?.length ?? 0) > 0);
  if (withPrep.length > 0 && withPrep.length < POSITION_CODES.length) {
    problems.push('La preparación debe venir para todas las posiciones o para ninguna');
  }
  for (const pos of withPrep) {
    const items = prepItems[pos] ?? [];
    items.forEach((item, i) => {
      const correct = item.options.filter((option) => option.isCorrect).length;
      if (correct !== 1) {
        problems.push(`Preparación de ${pos} #${i + 1}: ${correct} correctas (debe ser 1)`);
      }
    });
  }

  return problems;
}
