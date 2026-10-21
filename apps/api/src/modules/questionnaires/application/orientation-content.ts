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
  prepItems: Record<
    PositionCode,
    { text: string; options: { label: string; isCorrect: boolean }[] }[]
  >;
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

  for (const pos of POSITION_CODES) {
    const items = prepItems[pos] ?? [];
    if (items.length === 0) problems.push(`Preparación de ${pos}: sin ítems`);
    items.forEach((item, i) => {
      const correct = item.options.filter((option) => option.isCorrect).length;
      if (correct !== 1) {
        problems.push(`Preparación de ${pos} #${i + 1}: ${correct} correctas (debe ser 1)`);
      }
    });
  }

  return problems;
}
