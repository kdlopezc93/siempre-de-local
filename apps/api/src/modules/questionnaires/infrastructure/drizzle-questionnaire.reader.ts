import { Inject, Injectable } from '@nestjs/common';
import type { PositionCode } from '@sdl/domain';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  QuestionnaireContent,
  QuestionnaireReader,
} from '../application/ports/questionnaire.reader.js';
import {
  optionWeight,
  positionItem,
  positionOption,
  prepItem,
  prepOption,
  questionnaireVersion,
} from './schema.js';

@Injectable()
export class DrizzleQuestionnaireReader implements QuestionnaireReader {
  /** Una versión publicada es inmutable: se lee de la BD una sola vez por proceso. */
  private readonly cache = new Map<string, QuestionnaireContent>();

  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async currentPublishedId(): Promise<string | null> {
    const [row] = await this.connection.db
      .select({ id: questionnaireVersion.id })
      .from(questionnaireVersion)
      .where(eq(questionnaireVersion.status, 'published'))
      .orderBy(desc(questionnaireVersion.publishedAt))
      .limit(1);
    return row?.id ?? null;
  }

  async load(versionId: string): Promise<QuestionnaireContent | null> {
    const cached = this.cache.get(versionId);
    if (cached) return cached;

    const { db } = this.connection;
    const [version] = await db
      .select()
      .from(questionnaireVersion)
      .where(and(eq(questionnaireVersion.id, versionId), ne(questionnaireVersion.status, 'draft')));
    if (!version) return null;

    const items = await db
      .select()
      .from(positionItem)
      .where(eq(positionItem.versionId, versionId))
      .orderBy(asc(positionItem.sort));
    const options = items.length
      ? await db
          .select()
          .from(positionOption)
          .where(
            inArray(
              positionOption.itemId,
              items.map((i) => i.id),
            ),
          )
          .orderBy(asc(positionOption.sort))
      : [];
    const weights = options.length
      ? await db
          .select()
          .from(optionWeight)
          .where(
            inArray(
              optionWeight.optionId,
              options.map((o) => o.id),
            ),
          )
      : [];
    const preps = await db
      .select()
      .from(prepItem)
      .where(eq(prepItem.versionId, versionId))
      .orderBy(asc(prepItem.position), asc(prepItem.sort));
    const prepOptions = preps.length
      ? await db
          .select()
          .from(prepOption)
          .where(
            inArray(
              prepOption.itemId,
              preps.map((p) => p.id),
            ),
          )
          .orderBy(asc(prepOption.sort))
      : [];

    const pointsByOption = new Map<string, Partial<Record<PositionCode, number>>>();
    for (const w of weights) {
      pointsByOption.set(w.optionId, { ...pointsByOption.get(w.optionId), [w.position]: w.points });
    }
    const content: QuestionnaireContent = {
      versionId: version.id,
      label: version.label,
      positionItemsPerAttempt: version.positionItemsPerAttempt,
      positionItems: items.map((item) => ({
        id: item.id,
        code: item.code,
        context: item.context,
        text: item.text,
        options: options
          .filter((o) => o.itemId === item.id)
          .map((o) => ({ id: o.id, label: o.label, points: pointsByOption.get(o.id) ?? {} })),
      })),
      prepItems: preps.map((item) => ({
        id: item.id,
        position: item.position,
        text: item.text,
        options: prepOptions
          .filter((o) => o.itemId === item.id)
          .map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
      })),
    };
    this.cache.set(versionId, content);
    return content;
  }
}
