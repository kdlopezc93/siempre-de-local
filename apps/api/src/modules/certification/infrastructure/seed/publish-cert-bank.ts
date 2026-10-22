import { DEFAULT_EXAM_CONFIG, lintBank, type ExamConfig } from '@sdl/domain';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../../../shared/db/client.js';
import type { CertBankContent } from '../../application/cert-bank.js';
import { certArea, certBankVersion, certItem, certOption } from '../schema.js';

export type PublishOutcome = 'published' | 'already-exists' | 'pending-review';

export function bankConfig(bank: CertBankContent): ExamConfig {
  return { ...DEFAULT_EXAM_CONFIG, ...bank.config };
}

/**
 * Publica una versión del banco de una posición y retira la anterior de esa posición.
 * - Sin revisión de un entrenador (D10) no se publica: `pending-review`.
 * - Con errores de lint (02 §6.5) falla: no se publica a medias.
 * - Idempotente: si la versión ya existe no toca nada (publicada = inmutable).
 */
export async function publishCertBank(
  db: Database,
  draft: CertBankContent,
  opts: { draftsForDevelopment?: boolean } = {},
): Promise<PublishOutcome> {
  // Solo en desarrollo: un borrador se publica con otra etiqueta (`v1-borrador`), así la
  // versión revisada la reemplaza después sin chocar.
  const bank =
    !draft.review && opts.draftsForDevelopment
      ? {
          ...draft,
          label: `${draft.label}-borrador`,
          review: {
            by: 'Sin revisar (solo desarrollo)',
            on: new Date().toISOString().slice(0, 10),
          },
        }
      : draft;
  const { review } = bank;
  if (!review) return 'pending-review';
  const cfg = bankConfig(bank);
  const errors = lintBank(bank, cfg).filter((issue) => issue.level === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Banco ${bank.position} ${bank.label} con errores:\n- ${errors
        .map((e) => (e.item ? `${e.item}: ${e.message}` : e.message))
        .join('\n- ')}`,
    );
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: certBankVersion.id })
      .from(certBankVersion)
      .where(
        and(eq(certBankVersion.position, bank.position), eq(certBankVersion.label, bank.label)),
      );
    if (existing) return 'already-exists';

    // Las áreas son por posición y sobreviven a las versiones: se agregan las nuevas.
    await tx
      .insert(certArea)
      .values(bank.areas.map((a) => ({ position: bank.position, code: a.code, name: a.name })))
      .onConflictDoUpdate({
        target: [certArea.position, certArea.code],
        set: { name: sql`excluded.name` },
      });
    const areas = await tx
      .select({ id: certArea.id, code: certArea.code })
      .from(certArea)
      .where(eq(certArea.position, bank.position));
    const areaId = new Map(areas.map((a) => [a.code, a.id]));

    // Los exámenes viejos siguen apuntando a su versión, ya retirada.
    await tx
      .update(certBankVersion)
      .set({ status: 'retired' })
      .where(
        and(eq(certBankVersion.position, bank.position), eq(certBankVersion.status, 'published')),
      );

    const [version] = await tx
      .insert(certBankVersion)
      .values({
        position: bank.position,
        label: bank.label,
        status: 'published',
        itemsPerExam: cfg.itemsPerExam,
        timeLimitS: cfg.timeLimitSeconds,
        attemptIntervalDays: cfg.attemptIntervalDays,
        minItemsToPublish: cfg.minItemsToPublish,
        difficultyMix: {
          '1': cfg.difficultyMix[1],
          '2': cfg.difficultyMix[2],
          '3': cfg.difficultyMix[3],
        },
        reviewedBy: review.by,
        reviewedOn: review.on,
        publishedAt: new Date(),
      })
      .returning({ id: certBankVersion.id });

    for (const [sort, item] of bank.items.entries()) {
      const [row] = await tx
        .insert(certItem)
        .values({
          bankVersionId: version!.id,
          code: item.code,
          areaId: areaId.get(item.area)!,
          difficulty: item.difficulty,
          text: item.text,
          explanation: item.explanation,
          sort,
        })
        .returning({ id: certItem.id });
      await tx.insert(certOption).values(
        item.options.map((option, i) => ({
          itemId: row!.id,
          label: option.label,
          isCorrect: option.correct === true,
          sort: i,
        })),
      );
    }
    return 'published';
  });
}
