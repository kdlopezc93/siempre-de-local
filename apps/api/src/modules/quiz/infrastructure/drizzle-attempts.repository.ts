import { Inject, Injectable } from '@nestjs/common';
import type { PositionCode, RankingEntry } from '@sdl/domain';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  AttemptsRepository,
  NewAttempt,
  StoredAttempt,
} from '../application/ports/attempts.repository.js';
import { attemptAnswer, attemptItem, attemptResult, quizAttempt } from './schema.js';

const UNIQUE_VIOLATION = '23505';

const SELECTION = {
  id: quizAttempt.id,
  clientAttemptId: quizAttempt.clientAttemptId,
  userId: quizAttempt.userId,
  teamId: quizAttempt.teamId,
  format: quizAttempt.format,
  submittedAt: quizAttempt.submittedAt,
  winner: attemptResult.winner,
  ranking: attemptResult.ranking,
  prepScore: attemptResult.prepScore,
  prepTotal: attemptResult.prepTotal,
};

type Row = {
  id: string;
  clientAttemptId: string;
  userId: string;
  teamId: string | null;
  format: StoredAttempt['format'];
  submittedAt: Date;
  winner: PositionCode;
  ranking: { pos: string; pct: number; earned: number; maxp: number }[];
  prepScore: number;
  prepTotal: number;
};

function toStored(row: Row): StoredAttempt {
  return {
    id: row.id,
    clientAttemptId: row.clientAttemptId,
    userId: row.userId,
    teamId: row.teamId!,
    format: row.format,
    submittedAt: row.submittedAt,
    result: {
      winner: row.winner,
      ranking: row.ranking as RankingEntry[],
      prepScore: row.prepScore,
      prepTotal: row.prepTotal,
    },
  };
}

@Injectable()
export class DrizzleAttemptsRepository implements AttemptsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  /** Solo el resultado oficial: si algún día se re-puntúa, convive con el anterior. */
  private official() {
    return this.connection.db
      .select(SELECTION)
      .from(quizAttempt)
      .innerJoin(
        attemptResult,
        and(eq(attemptResult.attemptId, quizAttempt.id), eq(attemptResult.isOfficial, true)),
      );
  }

  async findByClientId(userId: string, clientAttemptId: string): Promise<StoredAttempt | null> {
    const [row] = await this.official().where(
      and(eq(quizAttempt.userId, userId), eq(quizAttempt.clientAttemptId, clientAttemptId)),
    );
    return row ? toStored(row) : null;
  }

  async findById(attemptId: string): Promise<StoredAttempt | null> {
    const [row] = await this.official().where(eq(quizAttempt.id, attemptId));
    return row ? toStored(row) : null;
  }

  async listByUser(userId: string): Promise<StoredAttempt[]> {
    const rows = await this.official()
      .where(eq(quizAttempt.userId, userId))
      .orderBy(desc(quizAttempt.submittedAt));
    return rows.map(toStored);
  }

  async save({ userId, request, scoringVersion, result, receivedAt }: NewAttempt) {
    const submittedAt = new Date(request.submittedAt);
    try {
      return await this.connection.db.transaction(async (tx) => {
        const [attempt] = await tx
          .insert(quizAttempt)
          .values({
            clientAttemptId: request.clientAttemptId,
            userId,
            teamId: request.teamId,
            questionnaireVersionId: request.questionnaireVersionId,
            format: request.format,
            status: 'scored',
            startedAt: new Date(request.startedAt),
            submittedAt,
            receivedAt,
          })
          .returning({ id: quizAttempt.id });
        const attemptId = attempt!.id;

        const served = [
          ...request.positionItems.map((s) => ({ ...s, phase: 'position' as const })),
          ...request.prepItems.map((s) => ({ ...s, phase: 'prep' as const })),
        ];
        await tx.insert(attemptItem).values(
          served.map((s) => ({
            attemptId,
            phase: s.phase,
            itemId: s.itemId,
            shownOrder: s.shownOrder,
            optionOrder: s.optionOrder,
          })),
        );
        // El celular no manda la hora de cada respuesta: se usa la del envío.
        await tx.insert(attemptAnswer).values(
          served.map((s) => ({
            attemptId,
            itemId: s.itemId,
            optionId: s.answerOptionId,
            answeredAt: submittedAt,
          })),
        );
        await tx.insert(attemptResult).values({
          attemptId,
          scoringVersion,
          winner: result.winner,
          ranking: result.ranking,
          prepScore: result.prepScore,
          prepTotal: result.prepTotal,
          isOfficial: true,
        });

        return {
          id: attemptId,
          clientAttemptId: request.clientAttemptId,
          userId,
          teamId: request.teamId,
          format: request.format,
          submittedAt,
          result,
        } satisfies StoredAttempt;
      });
    } catch (error) {
      const cause =
        error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error;
      if (cause instanceof DatabaseError && cause.code === UNIQUE_VIOLATION) return 'duplicate';
      throw error;
    }
  }
}
