import { Inject, Injectable } from '@nestjs/common';
import type { ValidationResponse } from '@sdl/contracts';
import {
  MIN_PAIRS_FOR_CORRELATION,
  positionAverages,
  spearman,
  testVsStaff,
  type BlindPair,
  type PositionCode,
} from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor, ratableBy } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  ASSESSMENTS_REPOSITORY,
  type AssessmentsRepository,
} from '../../assessments/application/ports/assessments.repository.js';
import {
  RATINGS_REPOSITORY,
  type RatingsRepository,
} from '../../ratings/application/ports/ratings.repository.js';
import {
  KNOWLEDGE_QUERY,
  type KnowledgeQuery,
  LATEST_RESULTS_QUERY,
  type LatestResultsQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from './ports/squad.ports.js';

/** Validación interna (02 §11): test vs. valoraciones a ciegas, y conocimiento vs. tarjeta. */
@Injectable()
export class GetValidation {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(ASSESSMENTS_REPOSITORY) private readonly assessments: AssessmentsRepository,
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(KNOWLEDGE_QUERY) private readonly knowledge: KnowledgeQuery,
  ) {}

  async execute(actor: Actor, teamId: string): Promise<ValidationResponse> {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.results.read', { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    const ids = (await this.players.activePlayers(teamId)).map((p) => p.userId);
    const active = new Set(ids);
    const [results, assessments, assessedByMe, cards, knowledge, staff] = await Promise.all([
      this.results.latestByTeam(teamId),
      this.assessments.listByTeam(teamId),
      this.assessments.assessedBy(actor.userId, teamId),
      this.ratings.latestByTeam(teamId),
      this.knowledge.summaryOf(ids),
      this.players.activeStaff(teamId),
    ]);
    // Quien valora solo ve aquí a los jugadores que ya valoró (cuyo test ya puede ver); los
    // que no puede valorar (él mismo, otro del cuerpo técnico) no destapan nada.
    const ratable = ratableBy(actor, teamId, staff);
    const visible = (playerId: string) => !ratable(playerId) || assessedByMe.has(playerId);

    const pairs: BlindPair[] = assessments
      .filter((a) => a.blind && active.has(a.playerId) && visible(a.playerId))
      .flatMap((a) => {
        const result = results.get(a.playerId);
        return result ? [{ staff: a.primaryPosition, podium: result.podium }] : [];
      });

    const byPosition = new Map<PositionCode, { pct: number; mp: number }[]>();
    for (const playerId of ids) {
      const card = cards.get(playerId);
      if (!card) continue;
      const mp = positionAverages(card.values);
      for (const k of knowledge.get(playerId) ?? []) {
        const average = mp[k.position];
        if (k.pct === null || average === undefined) continue;
        byPosition.set(k.position, [
          ...(byPosition.get(k.position) ?? []),
          { pct: k.pct, mp: average },
        ]);
      }
    }

    return {
      testVsStaff: testVsStaff(pairs),
      knowledgeVsCard: [...byPosition].map(([position, points]) => ({
        position,
        points,
        rho:
          points.length >= MIN_PAIRS_FOR_CORRELATION
            ? spearman(
                points.map((p) => p.pct),
                points.map((p) => p.mp),
              )
            : null,
      })),
    };
  }
}
