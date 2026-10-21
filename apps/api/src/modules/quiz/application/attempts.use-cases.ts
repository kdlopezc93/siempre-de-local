import { Inject, Injectable } from '@nestjs/common';
import type { AttemptResult, SubmitAttemptRequest } from '@sdl/contracts';
import { ORIENTATION_SCORING_VERSION, scorePosition } from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can } from '../../../shared/authz/policy.js';
import { CONSENT_CHECKER, type ConsentChecker } from '../../../shared/consent/consent.port.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  QUESTIONNAIRE_READER,
  type QuestionnaireReader,
} from '../../questionnaires/application/ports/questionnaire.reader.js';
import {
  TEAMS_REPOSITORY,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  ATTEMPTS_REPOSITORY,
  type AttemptsRepository,
  type StoredAttempt,
} from './ports/attempts.repository.js';
import { checkTimes, positionPart } from './validate-submission.js';

export function toAttemptResult(attempt: StoredAttempt): AttemptResult {
  const { ranking } = attempt.result;
  const podium = ranking.slice(0, 3).map((entry) => entry.pos);
  return {
    attemptId: attempt.id,
    clientAttemptId: attempt.clientAttemptId,
    teamId: attempt.teamId,
    format: attempt.format,
    submittedAt: attempt.submittedAt.toISOString(),
    winner: ranking[0]!.pos,
    ranking: ranking.map(({ pos, pct }) => ({ pos, pct })),
    podium,
    // Puede certificarse en cualquiera de las tres (Fase 4).
    suggestedKnowledgeExams: podium,
  };
}

@Injectable()
export class SubmitAttempt {
  constructor(
    @Inject(ATTEMPTS_REPOSITORY) private readonly attempts: AttemptsRepository,
    @Inject(QUESTIONNAIRE_READER) private readonly questionnaires: QuestionnaireReader,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(CONSENT_CHECKER) private readonly consent: ConsentChecker,
  ) {}

  /**
   * El servidor calcula el resultado oficial; el cliente solo dice qué vio y qué eligió
   * (00 §5). El podio que el celular muestra sin conexión es provisional.
   */
  async execute(
    userId: string,
    request: SubmitAttemptRequest,
    now = new Date(),
  ): Promise<{ result: AttemptResult; created: boolean }> {
    // Un reenvío de la cola offline devuelve el mismo resultado (05 · idempotencia).
    const existing = await this.attempts.findByClientId(userId, request.clientAttemptId);
    if (existing) return { result: toAttemptResult(existing), created: false };

    if (!(await this.consent.hasCurrentConsent(userId))) {
      throw new ForbiddenError('Antes de seguir acepta la política de datos.', 'CONSENT_REQUIRED');
    }
    const team = await this.teams.findById(request.teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    const actor = {
      userId,
      platformAdmin: false,
      ...(await this.memberships.loadMemberships(userId)),
    };
    if (!can(actor, 'team.quiz.take', { teamId: team.id, clubId: team.club.id })) {
      throw new ForbiddenError('Solo los jugadores del equipo hacen el test en él.');
    }
    if (request.format !== team.format) {
      throw new BusinessRuleError('El formato no es el del equipo.', 'FORMAT_MISMATCH');
    }

    const content = await this.questionnaires.load(request.questionnaireVersionId);
    if (!content) {
      throw new BusinessRuleError(
        'Esa versión del test no existe.',
        'QUESTIONNAIRE_VERSION_UNKNOWN',
      );
    }
    checkTimes(request, now);

    const position = positionPart(content, request);
    const ranking = scorePosition(position.items, position.answers, request.format);

    const saved = await this.attempts.save({
      userId,
      request,
      scoringVersion: ORIENTATION_SCORING_VERSION,
      receivedAt: now,
      result: { ranking },
    });
    if (saved === 'duplicate') {
      const winnerOfRace = await this.attempts.findByClientId(userId, request.clientAttemptId);
      return { result: toAttemptResult(winnerOfRace!), created: false };
    }
    return { result: toAttemptResult(saved), created: true };
  }
}

@Injectable()
export class MyAttempts {
  constructor(@Inject(ATTEMPTS_REPOSITORY) private readonly attempts: AttemptsRepository) {}

  async list(userId: string): Promise<AttemptResult[]> {
    return (await this.attempts.listByUser(userId)).map(toAttemptResult);
  }

  /** Solo su dueño por ahora (el cuerpo técnico llega en Fase 3). 404 también si es ajeno. */
  async get(userId: string, attemptId: string): Promise<AttemptResult> {
    const attempt = await this.attempts.findById(attemptId);
    if (!attempt || attempt.userId !== userId) throw new NotFoundError('Intento no encontrado');
    return toAttemptResult(attempt);
  }
}
