import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateKnowledgeReviewRequestSchema,
  KnowledgeReview,
  PlayerKnowledge,
  SquadPlayer,
  VoidExamRequestSchema,
} from '@sdl/contracts';
import { bandFor, bestKnowledge, type PositionCode } from '@sdl/domain';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import type { KnowledgeQuery } from '../../squad/application/ports/squad.ports.js';
import { summary, toResult, toReview } from './cert-exams.use-cases.js';
import {
  CERT_EXAMS_REPOSITORY,
  type Area,
  type CertExamsRepository,
} from './ports/cert-exams.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * El examen de conocimiento visto por el cuerpo técnico (02 §6.6–6.7): anular intentos,
 * pedir re-evaluaciones y leer el conocimiento de los jugadores.
 */
@Injectable()
export class KnowledgeStaff implements KnowledgeQuery {
  constructor(
    @Inject(CERT_EXAMS_REPOSITORY) private readonly exams: CertExamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  /** Anular: deja de contar y pasa a valer el mejor de los restantes. Motivo obligatorio. */
  async voidExam(
    actor: Actor,
    teamId: string,
    examId: string,
    request: z.output<typeof VoidExamRequestSchema>,
    now = new Date(),
  ): Promise<void> {
    await this.authorize(actor, teamId, 'team.attempts.void');
    const exam = await this.exams.findExam(examId);
    // Solo exámenes de jugadores de este equipo; lo demás no existe para quien pregunta.
    if (!exam || !(await this.isPlayer(exam.userId, teamId))) {
      throw new NotFoundError('Examen no encontrado');
    }
    if (exam.status === 'void') {
      throw new ConflictError('Ese examen ya está anulado.', 'EXAM_ALREADY_VOID');
    }
    if (exam.status !== 'submitted') {
      throw new BusinessRuleError('Solo se anula un examen entregado.', 'EXAM_NOT_SUBMITTED');
    }
    await this.exams.voidExam(examId, {
      reason: request.reason,
      by: actor.userId,
      at: now,
      resetsInterval: request.resetInterval,
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cert_exam.voided',
      entity: 'cert_exam',
      entityId: examId,
      teamId,
      meta: { playerId: exam.userId, reason: request.reason, resetInterval: request.resetInterval },
    });
  }

  /** Pedir una re-evaluación: motivo visible para el jugador y plazo (14 días por defecto). */
  async requestReview(
    actor: Actor,
    teamId: string,
    playerId: string,
    request: z.output<typeof CreateKnowledgeReviewRequestSchema>,
    now = new Date(),
  ): Promise<KnowledgeReview> {
    await this.authorize(actor, teamId, 'team.reevaluations.request');
    if (!(await this.isPlayer(playerId, teamId))) {
      throw new NotFoundError('Ese jugador no está en el equipo', 'PLAYER_NOT_IN_TEAM');
    }
    if (!(await this.exams.publishedBank(request.position))) {
      throw new BusinessRuleError('Todavía no hay examen para esa posición.', 'NO_PUBLISHED_BANK');
    }
    await this.exams.expireDueReviews(now);
    const created = await this.exams.createReview({
      teamId,
      playerUserId: playerId,
      position: request.position,
      requestedBy: actor.userId,
      reason: request.reason,
      requestedAt: now,
      dueAt: new Date(now.getTime() + request.dueInDays * DAY_MS),
    });
    if (created === 'already-open') {
      throw new ConflictError(
        'Ya tiene una re-evaluación abierta de esa posición.',
        'REVIEW_ALREADY_OPEN',
      );
    }
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cert_review.requested',
      entity: 'cert_review_request',
      entityId: created.id,
      teamId,
      meta: { playerId, position: request.position, dueInDays: request.dueInDays },
    });
    return toReview(created, now);
  }

  async cancelReview(actor: Actor, teamId: string, reviewId: string, now = new Date()) {
    await this.authorize(actor, teamId, 'team.reevaluations.request');
    const review = await this.exams.findReview(reviewId);
    if (!review || review.teamId !== teamId) {
      throw new NotFoundError('Re-evaluación no encontrada');
    }
    if (review.status !== 'pending' && review.status !== 'expired') {
      throw new ConflictError('Esa re-evaluación ya está cerrada.', 'REVIEW_CLOSED');
    }
    await this.exams.closeReview(reviewId, { status: 'cancelled', at: now });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'cert_review.cancelled',
      entity: 'cert_review_request',
      entityId: reviewId,
      teamId,
      meta: { playerId: review.playerUserId, position: review.position },
    });
  }

  /** Para el perfil: mejor puntaje por posición, re-evaluación abierta y todos sus exámenes. */
  async ofPlayer(userId: string, now = new Date()): Promise<PlayerKnowledge> {
    await this.exams.expireDueReviews(now);
    const [banks, exams, reviews] = await Promise.all([
      this.exams.publishedBanks(),
      this.exams.examsOf(userId),
      this.exams.openReviews([userId]),
    ]);
    const closed = exams.filter((e) => e.status !== 'in_progress');
    const summaries = closed.map(summary);
    const positions = [
      ...new Set<PositionCode>([
        ...banks.map((b) => b.position),
        ...closed.map((e) => e.position),
        ...reviews.map((r) => r.position),
      ]),
    ];
    const areas = new Map<PositionCode, Area[]>();
    for (const position of new Set(closed.map((e) => e.position))) {
      areas.set(position, await this.exams.areasOf(position));
    }
    return {
      positions: positions.map((position) => {
        const review = reviews.find((r) => r.position === position);
        return {
          position,
          best: bestKnowledge(summaries, position),
          review: review ? toReview(review, now) : null,
        };
      }),
      exams: closed.map((e) => toResult(e, areas.get(e.position)!)),
    };
  }

  /** Para la plantilla: por jugador, su mejor puntaje en cada posición y si hay re-evaluación. */
  async summaryOf(userIds: string[], now = new Date()) {
    await this.exams.expireDueReviews(now);
    const [exams, reviews] = await Promise.all([
      this.exams.examsOfUsers(userIds),
      this.exams.openReviews(userIds),
    ]);
    const out = new Map<string, SquadPlayer['knowledge']>();
    for (const userId of userIds) {
      const mine = exams.filter((e) => e.userId === userId && e.status !== 'in_progress');
      const open = reviews.filter((r) => r.playerUserId === userId);
      const summaries = mine.map(summary);
      const positions = [
        ...new Set([...mine.map((e) => e.position), ...open.map((r) => r.position)]),
      ];
      out.set(
        userId,
        positions.map((position) => {
          const best = bestKnowledge(summaries, position);
          const review = open.find((r) => r.position === position);
          return {
            position,
            pct: best?.pct ?? null,
            band: best ? bandFor(best.pct) : null,
            review: review ? (toReview(review, now).status as 'pending' | 'expired') : null,
          };
        }),
      );
    }
    return out;
  }

  private async isPlayer(userId: string, teamId: string) {
    const memberships = await this.memberships.loadMemberships(userId);
    return memberships.teams.get(teamId)?.includes('player') ?? false;
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
  }
}
