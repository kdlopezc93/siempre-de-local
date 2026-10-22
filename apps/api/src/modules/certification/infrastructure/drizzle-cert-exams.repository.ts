import { Inject, Injectable } from '@nestjs/common';
import type { Difficulty, PositionCode } from '@sdl/domain';
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type {
  CertExamsRepository,
  ExamClosing,
  NewExam,
  PublishedBank,
  StoredExam,
  StoredReview,
} from '../application/ports/cert-exams.repository.js';
import {
  certArea,
  certBankVersion,
  certExam,
  certExamItem,
  certItem,
  certOption,
  certReviewRequest,
} from './schema.js';

const UNIQUE_VIOLATION = '23505';

/** Drizzle envuelve el error de Postgres en `cause`. */
function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error;
  return cause instanceof DatabaseError && cause.code === UNIQUE_VIOLATION;
}

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
      if (isUniqueViolation(error)) return 'in-progress';
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

  async voidExam(
    examId: string,
    {
      reason,
      by,
      at,
      resetsInterval,
    }: { reason: string; by: string; at: Date; resetsInterval: boolean },
  ) {
    const updated = await this.connection.db
      .update(certExam)
      .set({
        status: 'void',
        voidReason: reason,
        voidedBy: by,
        voidedAt: at,
        voidResetsInterval: resetsInterval,
      })
      .where(and(eq(certExam.id, examId), eq(certExam.status, 'submitted')))
      .returning({ id: certExam.id });
    return updated.length > 0;
  }

  async supersedeEarlier(userId: string, position: PositionCode, before: Date, at: Date) {
    await this.connection.db
      .update(certExam)
      .set({ supersededAt: at })
      .where(
        and(
          eq(certExam.userId, userId),
          eq(certExam.position, position),
          eq(certExam.status, 'submitted'),
          lt(certExam.startedAt, before),
          sql`${certExam.supersededAt} is null`,
        ),
      );
  }

  async restoreSuperseded(userId: string, position: PositionCode, at: Date) {
    await this.connection.db
      .update(certExam)
      .set({ supersededAt: null })
      .where(
        and(
          eq(certExam.userId, userId),
          eq(certExam.position, position),
          eq(certExam.supersededAt, at),
        ),
      );
  }

  async reopenReview(reviewId: string, now: Date) {
    try {
      const updated = await this.connection.db
        .update(certReviewRequest)
        .set({
          status: sql`case when ${certReviewRequest.dueAt} < ${now} then 'expired' else 'pending' end::cert_review_status`,
          resolvedExamId: null,
          closedAt: null,
        })
        .where(and(eq(certReviewRequest.id, reviewId), eq(certReviewRequest.status, 'completed')))
        .returning({ id: certReviewRequest.id });
      return updated.length > 0;
    } catch (error) {
      // Ya pidieron otra re-evaluación de esa posición: queda esa.
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async examsOfUsers(userIds: string[]) {
    if (userIds.length === 0) return [];
    return this.connection.db
      .select()
      .from(certExam)
      .where(inArray(certExam.userId, userIds))
      .orderBy(desc(certExam.startedAt));
  }

  async expireDueReviews(now: Date) {
    await this.connection.db
      .update(certReviewRequest)
      .set({ status: 'expired' })
      .where(and(eq(certReviewRequest.status, 'pending'), lt(certReviewRequest.dueAt, now)));
  }

  private selectReviews() {
    return this.connection.db
      .select({
        id: certReviewRequest.id,
        teamId: certReviewRequest.teamId,
        playerUserId: certReviewRequest.playerUserId,
        position: certReviewRequest.position,
        reason: certReviewRequest.reason,
        requestedAt: certReviewRequest.requestedAt,
        dueAt: certReviewRequest.dueAt,
        status: certReviewRequest.status,
        requesterId: certReviewRequest.requestedBy,
        requesterName: user.name,
        resolvedExamId: certReviewRequest.resolvedExamId,
      })
      .from(certReviewRequest)
      .leftJoin(user, eq(certReviewRequest.requestedBy, user.id));
  }

  private toReview({
    requesterId,
    requesterName,
    ...row
  }: Awaited<ReturnType<DrizzleCertExamsRepository['selectReviews']>>[number]): StoredReview {
    return {
      ...row,
      requestedBy: requesterId ? { id: requesterId, name: requesterName ?? '' } : null,
    };
  }

  async openReviews(userIds: string[]) {
    if (userIds.length === 0) return [];
    const rows = await this.selectReviews().where(
      and(
        inArray(certReviewRequest.playerUserId, userIds),
        inArray(certReviewRequest.status, ['pending', 'expired']),
      ),
    );
    return rows.map((r) => this.toReview(r));
  }

  async findReview(reviewId: string) {
    const [row] = await this.selectReviews().where(eq(certReviewRequest.id, reviewId));
    return row ? this.toReview(row) : null;
  }

  async createReview(review: {
    teamId: string;
    playerUserId: string;
    position: PositionCode;
    requestedBy: string;
    reason: string;
    requestedAt: Date;
    dueAt: Date;
  }) {
    try {
      const [row] = await this.connection.db
        .insert(certReviewRequest)
        .values(review)
        .returning({ id: certReviewRequest.id });
      return (await this.findReview(row!.id))!;
    } catch (error) {
      if (isUniqueViolation(error)) return 'already-open';
      throw error;
    }
  }

  async closeReview(
    reviewId: string,
    {
      status,
      at,
      resolvedExamId,
    }: { status: 'completed' | 'cancelled'; at: Date; resolvedExamId?: string },
  ) {
    await this.connection.db
      .update(certReviewRequest)
      .set({ status, closedAt: at, resolvedExamId: resolvedExamId ?? null })
      .where(
        and(
          eq(certReviewRequest.id, reviewId),
          inArray(certReviewRequest.status, ['pending', 'expired']),
        ),
      );
  }
}
