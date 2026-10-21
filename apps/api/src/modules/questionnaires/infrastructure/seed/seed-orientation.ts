import type { PositionCode } from '@sdl/domain';
import { eq } from 'drizzle-orm';

import type { Database } from '../../../../shared/db/client.js';
import {
  type OrientationContent,
  validateOrientationContent,
} from '../../application/orientation-content.js';
import {
  optionWeight,
  positionItem,
  positionOption,
  prepItem,
  prepOption,
  questionnaireVersion,
} from '../schema.js';

export type SeedOutcome = 'created' | 'already-exists';

/**
 * Guarda y publica una versión del test de orientación. Idempotente: si la etiqueta
 * ya existe no toca nada, porque una versión publicada es inmutable.
 */
export async function seedOrientationContent(
  db: Database,
  content: OrientationContent,
): Promise<SeedOutcome> {
  const problems = validateOrientationContent(content);
  if (problems.length > 0) {
    throw new Error(`Contenido ${content.label} inválido:\n- ${problems.join('\n- ')}`);
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: questionnaireVersion.id })
      .from(questionnaireVersion)
      .where(eq(questionnaireVersion.label, content.label));
    if (existing.length > 0) return 'already-exists';

    const [version] = await tx
      .insert(questionnaireVersion)
      .values({
        label: content.label,
        status: 'published',
        positionItemsPerAttempt: content.positionItemsPerAttempt,
        publishedAt: new Date(),
      })
      .returning({ id: questionnaireVersion.id });
    const versionId = version!.id;

    for (const [sort, item] of content.positionItems.entries()) {
      const [row] = await tx
        .insert(positionItem)
        .values({ versionId, code: item.code, context: item.context, text: item.text, sort })
        .returning({ id: positionItem.id });
      const options = await tx
        .insert(positionOption)
        .values(
          item.options.map((option, i) => ({ itemId: row!.id, label: option.label, sort: i })),
        )
        .returning({ id: positionOption.id, sort: positionOption.sort });
      await tx.insert(optionWeight).values(
        options.flatMap(({ id, sort: i }) =>
          Object.entries(item.options[i]!.points).map(([position, points]) => ({
            optionId: id,
            position: position as PositionCode,
            points: points!,
          })),
        ),
      );
    }

    for (const [position, items] of Object.entries(content.prepItems)) {
      for (const [sort, item] of items.entries()) {
        const [row] = await tx
          .insert(prepItem)
          .values({
            versionId,
            position: position as PositionCode,
            text: item.text,
            sort,
          })
          .returning({ id: prepItem.id });
        await tx.insert(prepOption).values(
          item.options.map((option, i) => ({
            itemId: row!.id,
            label: option.label,
            isCorrect: option.isCorrect,
            sort: i,
          })),
        );
      }
    }

    return 'created';
  });
}
