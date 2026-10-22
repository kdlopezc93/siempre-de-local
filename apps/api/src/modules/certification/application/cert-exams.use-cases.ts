import { Inject, Injectable } from '@nestjs/common';
import type {
  CertPositionsResponse,
  ExamInProgress,
  KnowledgeReview,
  ExamResponse,
  ExamResult,
  StartExamRequest,
} from '@sdl/contracts';
import {
  bestKnowledge,
  canStartExam,
  nextAttemptFrom,
  scoreExam,
  selectExamItems,
  type ExamSummary,
  type PositionCode,
} from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  CERT_EXAMS_REPOSITORY,
  type Area,
  type CertExamsRepository,
  type StoredExam,
  type StoredReview,
} from './ports/cert-exams.repository.js';

/** Margen para la latencia: una respuesta enviada justo al límite todavía cuenta. */
const DEADLINE_GRACE_MS = 10_000;

/** Azar del servidor para sortear preguntas y barajar opciones. Inyectable en tests. */
export const EXAM_RANDOM = Symbol('EXAM_RANDOM');
export type ExamRandom = () => number;

function shuffle<T>(items: readonly T[], rng: ExamRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const summary = (e: StoredExam): ExamSummary => ({
  id: e.id,
  position: e.position,
  status: e.status,
  pct: e.pct,
  startedAt: e.startedAt,
  submittedAt: e.submittedAt,
  nextAttemptAt: e.nextAttemptAt,
  underReview: e.underReview,
  superseded: e.supersededAt !== null,
  voidResetsInterval: e.voidResetsInterval,
});

/** Una re-evaluación tal como la ven el jugador y el cuerpo técnico. */
export function toReview(review: StoredReview, now: Date): KnowledgeReview {
  // Por si el vencimiento todavía no se guardó: vencida sigue abierta (02 §6.7).
  const status = review.status === 'pending' && review.dueAt < now ? 'expired' : review.status;
  return {
    id: review.id,
    position: review.position,
    reason: review.reason,
    requestedAt: review.requestedAt.toISOString(),
    dueAt: review.dueAt.toISOString(),
    status,
    requestedBy: review.requestedBy,
    resolvedExamId: review.resolvedExamId,
  };
}

export function toResult(exam: StoredExam, areas: readonly Area[]): ExamResult {
  const name = new Map(areas.map((a) => [a.code, a.name]));
  return {
    state: 'finished',
    examId: exam.id,
    position: exam.position,
    endedBy: exam.endedBy!,
    startedAt: exam.startedAt.toISOString(),
    submittedAt: exam.submittedAt!.toISOString(),
    score: exam.score!,
    total: exam.total!,
    pct: exam.pct!,
    band: exam.band!,
    byArea: exam.byArea!.map(({ area, correct, total }) => ({
      area: { code: area, name: name.get(area) ?? area },
      correct,
      total,
    })),
    nextAttemptAt: exam.nextAttemptAt.toISOString(),
    voided:
      exam.status === 'void'
        ? { reason: exam.voidReason ?? '', at: (exam.voidedAt ?? exam.submittedAt!).toISOString() }
        : null,
    superseded: exam.supersededAt !== null,
    fromReview: exam.reviewRequestId !== null,
  };
}

/** El examen de conocimiento del jugador (02 §6). El plazo y el puntaje son del servidor. */
@Injectable()
export class CertExams {
  constructor(
    @Inject(CERT_EXAMS_REPOSITORY) private readonly exams: CertExamsRepository,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(EXAM_RANDOM) private readonly rng: ExamRandom,
  ) {}

  async positions(userId: string, now = new Date()): Promise<CertPositionsResponse> {
    await this.exams.expireDueReviews(now);
    const [banks, exams, reviews] = await Promise.all([
      this.exams.publishedBanks(),
      this.settled(userId, now),
      this.exams.openReviews([userId]),
    ]);
    const summaries = exams.map(summary);
    const active = exams.find((e) => e.status === 'in_progress');
    return {
      positions: banks.map((bank) => {
        const review = reviews.find((r) => r.position === bank.position);
        const check = canStartExam(summaries, bank.position, now, { pendingReview: !!review });
        return {
          position: bank.position,
          bank: {
            label: bank.label,
            itemsPerExam: bank.config.itemsPerExam,
            timeLimitSeconds: bank.config.timeLimitSeconds,
            attemptIntervalDays: bank.config.attemptIntervalDays,
            areas: bank.areas,
          },
          best: bestKnowledge(summaries, bank.position),
          review: review ? toReview(review, now) : null,
          nextAttemptAt:
            !check.ok && check.reason === 'ATTEMPT_INTERVAL'
              ? check.nextAttemptAt.toISOString()
              : null,
          activeExamId: active?.id ?? null,
        };
      }),
    };
  }

  async start(
    userId: string,
    request: StartExamRequest,
    now = new Date(),
  ): Promise<ExamInProgress> {
    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError('Antes de seguir acepta la política de datos.', 'CONSENT_REQUIRED');
    }
    if (request.teamId) {
      const mine = await this.memberships.loadMemberships(userId);
      if (!mine.teams.get(request.teamId)?.includes('player')) {
        throw new ForbiddenError('Solo los jugadores del equipo se examinan desde él.');
      }
    }
    const bank = await this.exams.publishedBank(request.position);
    if (!bank) {
      throw new BusinessRuleError('Todavía no hay examen para esa posición.', 'NO_PUBLISHED_BANK');
    }

    const exams = await this.settled(userId, now);
    await this.exams.expireDueReviews(now);
    // Una re-evaluación abierta salta la espera del mes y se liga al examen (02 §6.7).
    const review = (await this.exams.openReviews([userId])).find(
      (r) => r.position === request.position,
    );
    const check = canStartExam(exams.map(summary), request.position, now, {
      pendingReview: !!review,
    });
    if (!check.ok) {
      throw check.reason === 'EXAM_IN_PROGRESS'
        ? new ConflictError('Ya tienes un examen en curso.', 'EXAM_IN_PROGRESS').with({
            examId: check.examId,
          })
        : new BusinessRuleError(
            'Ya te examinaste de esta posición este mes.',
            'ATTEMPT_INTERVAL',
          ).with({ nextAttemptAt: check.nextAttemptAt.toISOString() });
    }

    const seen = await this.exams.seenItemIds(userId, request.position);
    const chosen = selectExamItems(bank.items, seen, bank.config, this.rng);
    const id = await this.exams.createExam({
      userId,
      teamId: request.teamId ?? null,
      bankVersionId: bank.id,
      position: request.position,
      startedAt: now,
      deadlineAt: new Date(now.getTime() + bank.config.timeLimitSeconds * 1000),
      nextAttemptAt: nextAttemptFrom(now, bank.config),
      reviewRequestId: review?.id ?? null,
      // Las opciones se barajan una vez y se guardan tal como se muestran.
      items: chosen.map((item) => ({
        itemId: item.id,
        optionOrder: shuffle(item.optionIds, this.rng),
      })),
    });
    if (id === 'in-progress') {
      throw new ConflictError('Ya tienes un examen en curso.', 'EXAM_IN_PROGRESS');
    }
    return this.inProgress((await this.exams.findExam(id))!, now);
  }

  /** Recuperar un examen (p. ej. tras recargar): en curso, o su resultado si ya cerró. */
  async get(userId: string, examId: string, now = new Date()): Promise<ExamResponse> {
    const exam = await this.settle(await this.own(userId, examId), now);
    return exam.status === 'in_progress'
      ? this.inProgress(exam, now)
      : toResult(exam, await this.exams.areasOf(exam.position));
  }

  async answer(
    userId: string,
    examId: string,
    itemId: string,
    optionId: string,
    now = new Date(),
  ): Promise<void> {
    const exam = await this.settle(await this.own(userId, examId), now);
    if (exam.status !== 'in_progress') {
      throw new BusinessRuleError(
        'Se acabó el tiempo: tu examen ya se cerró con lo que respondiste.',
        'EXAM_DEADLINE_PASSED',
      );
    }
    const item = (await this.exams.examItems(examId)).find((i) => i.itemId === itemId);
    if (!item || !item.options.some((o) => o.id === optionId)) {
      throw new BusinessRuleError('Esa respuesta no es de esta pregunta.', 'ANSWER_INVALID');
    }
    await this.exams.saveAnswer(examId, itemId, optionId, now);
  }

  submit(userId: string, examId: string, now = new Date()) {
    return this.finish(userId, examId, 'submit', now);
  }

  /** Abandonar: se puntúa lo respondido y el intento consume el mes (02 §6.3). */
  abandon(userId: string, examId: string, now = new Date()) {
    return this.finish(userId, examId, 'abandon', now);
  }

  async myExams(userId: string, now = new Date()): Promise<ExamResult[]> {
    // Entregados y anulados (el jugador ve por qué se anuló).
    const closed = (await this.settled(userId, now)).filter((e) => e.status !== 'in_progress');
    const areas = new Map<PositionCode, Area[]>();
    for (const position of new Set(closed.map((e) => e.position))) {
      areas.set(position, await this.exams.areasOf(position));
    }
    return closed.map((e) => toResult(e, areas.get(e.position)!));
  }

  private async finish(
    userId: string,
    examId: string,
    endedBy: 'submit' | 'abandon',
    now: Date,
  ): Promise<ExamResult> {
    let exam = await this.settle(await this.own(userId, examId), now);
    // Idempotente: entregar dos veces (o tras vencer) devuelve el mismo resultado.
    if (exam.status === 'in_progress') exam = await this.close(exam, endedBy, now);
    return toResult(exam, await this.exams.areasOf(exam.position));
  }

  private async own(userId: string, examId: string): Promise<StoredExam> {
    const exam = await this.exams.findExam(examId);
    // Ajeno = no existe: no se revela que hay un examen con ese id.
    if (!exam || exam.userId !== userId) throw new NotFoundError('Examen no encontrado');
    return exam;
  }

  /** Si venció el plazo, se cierra con lo respondido (lo demás cuenta como fallo). */
  private async settle(exam: StoredExam, now: Date): Promise<StoredExam> {
    if (exam.status !== 'in_progress') return exam;
    if (now.getTime() <= exam.deadlineAt.getTime() + DEADLINE_GRACE_MS) return exam;
    return this.close(exam, 'timeout', exam.deadlineAt);
  }

  private async settled(userId: string, now: Date): Promise<StoredExam[]> {
    const exams = await this.exams.examsOf(userId);
    return Promise.all(exams.map((e) => this.settle(e, now)));
  }

  private async close(
    exam: StoredExam,
    endedBy: 'submit' | 'abandon' | 'timeout',
    at: Date,
  ): Promise<StoredExam> {
    const items = await this.exams.examItems(exam.id);
    const result = scoreExam(
      items.map((i) => ({ id: i.itemId, area: i.area.code, correctOptionId: i.correctOptionId })),
      new Map(items.map((i) => [i.itemId, i.answerOptionId])),
    );
    const submittedAt = at < exam.deadlineAt ? at : exam.deadlineAt;
    const closed = await this.exams.closeExam(exam.id, {
      endedBy,
      submittedAt,
      score: result.score,
      total: result.total,
      pct: result.pct,
      band: result.band,
      byArea: result.byArea,
    });
    // Respondió una re-evaluación: la completa y su resultado reemplaza a los anteriores
    // de la posición, aunque sea más bajo (02 §6.7).
    if (closed && exam.reviewRequestId) {
      await this.exams.closeReview(exam.reviewRequestId, {
        status: 'completed',
        at: submittedAt,
        resolvedExamId: exam.id,
      });
      await this.exams.supersedeEarlier(exam.userId, exam.position, exam.startedAt, submittedAt);
    }
    // Si otra petición lo cerró antes, vale lo que quedó guardado.
    return (await this.exams.findExam(exam.id))!;
  }

  private async inProgress(exam: StoredExam, now: Date): Promise<ExamInProgress> {
    const items = await this.exams.examItems(exam.id);
    return {
      state: 'in_progress',
      examId: exam.id,
      position: exam.position,
      startedAt: exam.startedAt.toISOString(),
      deadlineAt: exam.deadlineAt.toISOString(),
      serverNow: now.toISOString(),
      items: items.map((i) => ({
        id: i.itemId,
        area: i.area,
        text: i.text,
        options: i.options,
        answerOptionId: i.answerOptionId,
      })),
    };
  }
}
