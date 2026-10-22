import { Inject, Injectable } from '@nestjs/common';
import type { Difficulty, PositionCode } from '@sdl/domain';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  CertExamsRepository,
  ExamClosing,
  NewExam,
  PublishedBank,
  StoredExam,
} from '../application/ports/cert-exams.repository.js';
import {
  certArea,
  certBankVersion,
  certExam,
  certExamItem,
  certItem,
  certOption,
} from './schema.js';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class DrizzleCertExamsRepository implements CertExamsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async publishedBanks() {
    const versions = await this.connection.db
      .select()
      .from(certBankVersion)
      .where(eq(certBankVersion.status, 'published'))
      .orderBy(asc(certBankVersion.position));
    return Promise.all(
      versions.map(async (v) => ({
        id: v.id,
        position: v.position,
        label: v.label,
        config: {
          itemsPerExam: v.itemsPerExam,
          timeLimitSeconds: v.timeLimitS,
          attemptIntervalDays: v.attemptIntervalDays,
          minItemsToPublish: v.minItemsToPublish,
          difficultyMix: {
            1: v.difficultyMix['1'],
            2: v.difficultyMix['2'],
            3: v.difficultyMix['3'],
          },
        },
        areas: await this.bankAreas(v.id),
      })),
    );
  }

  async publishedBank(position: PositionCode): Promise<PublishedBank | null> {
    const bank = (await this.publishedBanks()).find((b) => b.position === position);
    if (!bank) return null;
    const items = await this.connection.db
      .select({ id: certItem.id, area: certArea.code, difficulty: certItem.difficulty })
      .from(certItem)
      .innerJoin(certArea, eq(certItem.areaId, certArea.id))
      .where(eq(certItem.bankVersionId, bank.id));
    const options = items.length
      ? await this.connection.db
          .select({ id: certOption.id, itemId: certOption.itemId })
          .from(certOption)
          .where(
            inArray(
              certOption.itemId,
              items.map((i) => i.id),
            ),
          )
          .orderBy(asc(certOption.sort))
      : [];
    const optionIds = new Map<string, string[]>();
    for (const o of options) optionIds.set(o.itemId, [...(optionIds.get(o.itemId) ?? []), o.id]);
    return {
      ...bank,
      items: items.map((i) => ({
        ...i,
        difficulty: i.difficulty as Difficulty,
        optionIds: optionIds.get(i.id) ?? [],
      })),
    };
  }

  /** Las áreas que usa una versión, en el orden en que aparecen sus preguntas. */
  private async bankAreas(bankVersionId: string) {
    const rows = await this.connection.db
      .selectDistinctOn([certArea.code], {
        code: certArea.code,
        name: certArea.name,
        sort: certItem.sort,
      })
      .from(certItem)
      .innerJoin(certArea, eq(certItem.areaId, certArea.id))
      .where(eq(certItem.bankVersionId, bankVersionId))
      .orderBy(certArea.code, asc(certItem.sort));
    return rows.sort((a, b) => a.sort - b.sort).map(({ code, name }) => ({ code, name }));
  }

  areasOf(position: PositionCode) {
    return this.connection.db
      .select({ code: certArea.code, name: certArea.name })
      .from(certArea)
      .where(eq(certArea.position, position));
  }

  async examsOf(userId: string): Promise<StoredExam[]> {
    return this.connection.db
      .select()
      .from(certExam)
      .where(eq(certExam.userId, userId))
      .orderBy(desc(certExam.startedAt));
  }

  async seenItemIds(userId: string, position: PositionCode) {
    const rows = await this.connection.db
      .select({ itemId: certExamItem.itemId })
      .from(certExamItem)
      .innerJoin(certExam, eq(certExamItem.examId, certExam.id))
      .where(and(eq(certExam.userId, userId), eq(certExam.position, position)));
    return new Set(rows.map((r) => r.itemId));
  }

  async createExam({ items, ...exam }: NewExam) {
    try {
      return await this.connection.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(certExam)
          .values({ ...exam, status: 'in_progress' })
          .returning({ id: certExam.id });
        await tx.insert(certExamItem).values(
          items.map((item, i) => ({
            examId: row!.id,
            itemId: item.itemId,
            shownOrder: i + 1,
            optionOrder: item.optionOrder,
          })),
        );
        return row!.id;
      });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === UNIQUE_VIOLATION) return 'in-progress';
      throw error;
    }
  }

  async findExam(examId: string) {
    const [row] = await this.connection.db.select().from(certExam).where(eq(certExam.id, examId));
    return row ?? null;
  }

  async examItems(examId: string) {
    const { db } = this.connection;
    const rows = await db
      .select({
        itemId: certExamItem.itemId,
        optionOrder: certExamItem.optionOrder,
        answerOptionId: certExamItem.answerOptionId,
        text: certItem.text,
        areaCode: certArea.code,
        areaName: certArea.name,
      })
      .from(certExamItem)
      .innerJoin(certItem, eq(certExamItem.itemId, certItem.id))
      .innerJoin(certArea, eq(certItem.areaId, certArea.id))
      .where(eq(certExamItem.examId, examId))
      .orderBy(asc(certExamItem.shownOrder));
    if (rows.length === 0) return [];
    const options = await db
      .select({
        id: certOption.id,
        itemId: certOption.itemId,
        label: certOption.label,
        isCorrect: certOption.isCorrect,
      })
      .from(certOption)
      .where(
        inArray(
          certOption.itemId,
          rows.map((r) => r.itemId),
        ),
      );
    const byId = new Map(options.map((o) => [o.id, o]));
    return rows.map((r) => {
      const ordered = r.optionOrder.map((id) => byId.get(id)!);
      return {
        itemId: r.itemId,
        area: { code: r.areaCode, name: r.areaName },
        text: r.text,
        options: ordered.map(({ id, label }) => ({ id, label })),
        correctOptionId: ordered.find((o) => o.isCorrect)!.id,
        answerOptionId: r.answerOptionId,
      };
    });
  }

  async saveAnswer(examId: string, itemId: string, optionId: string, at: Date) {
    await this.connection.db
      .update(certExamItem)
      .set({ answerOptionId: optionId, answeredAt: at })
      .where(and(eq(certExamItem.examId, examId), eq(certExamItem.itemId, itemId)));
  }

  async closeExam(examId: string, closing: ExamClosing) {
    const updated = await this.connection.db
      .update(certExam)
      .set({ ...closing, status: 'submitted' })
      .where(and(eq(certExam.id, examId), eq(certExam.status, 'in_progress')))
      .returning({ id: certExam.id });
    return updated.length > 0;
  }
}
