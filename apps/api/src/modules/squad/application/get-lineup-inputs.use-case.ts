import { Inject, Injectable } from '@nestjs/common';
import type { LineupInputsResponse } from '@sdl/contracts';
import { positionAverages, type PositionCode } from '@sdl/domain';

import { can, type Actor } from '../../../shared/authz/policy.js';
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
  TEAMS_REPOSITORY,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  KNOWLEDGE_QUERY,
  type KnowledgeQuery,
  LATEST_RESULTS_QUERY,
  type LatestResultsQuery,
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from './ports/squad.ports.js';
import { assessesIn } from './staff-view.js';

/**
 * Las señales de cada jugador para armar en el celular (02 §9.1). Misma regla a ciegas que
 * la plantilla: para quien valora y todavía no valoró al jugador, su test no viaja.
 */
@Injectable()
export class GetLineupInputs {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(ASSESSMENTS_REPOSITORY) private readonly assessments: AssessmentsRepository,
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(KNOWLEDGE_QUERY) private readonly knowledge: KnowledgeQuery,
  ) {}

  async execute(actor: Actor, teamId: string): Promise<LineupInputsResponse> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.results.read', { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }

    const players = await this.players.activePlayers(teamId);
    const ids = players.map((p) => p.userId);
    const [profiles, results, latest, assessedByMe, cards, knowledge] = await Promise.all([
      this.profiles.profilesOf(players.map((p) => ({ id: p.userId, name: p.name }))),
      this.results.latestByTeam(teamId),
      this.assessments.latestByTeam(teamId),
      this.assessments.assessedBy(actor.userId, teamId),
      this.ratings.latestByTeam(teamId),
      this.knowledge.summaryOf(ids),
    ]);
    const assesses = assessesIn(actor, teamId);

    return {
      format: team.format,
      players: players
        .map((player) => {
          const profile = profiles.get(player.userId)!;
          const result = results.get(player.userId);
          const assessment = latest.get(player.userId);
          const card = cards.get(player.userId);
          const known = (knowledge.get(player.userId) ?? []).filter((k) => k.pct !== null);
          const hidden = assesses && !assessedByMe.has(player.userId);
          return {
            playerId: player.userId,
            displayName: profile.displayName,
            jerseyNumber: player.jerseyNumber,
            preferredPositions: profile.preferredPositions,
            ...(result && !hidden
              ? { affinity: Object.fromEntries(result.ranking.map((r) => [r.pos, r.pct])) }
              : {}),
            ...(assessment
              ? {
                  assessment: {
                    primary: assessment.primaryPosition,
                    secondary: assessment.secondaryPositions,
                  },
                }
              : {}),
            ...(known.length
              ? {
                  knowledge: Object.fromEntries(
                    known.map((k) => [
                      k.position,
                      { pct: k.pct!, reviewExpired: k.review === 'expired' },
                    ]),
                  ) as Partial<Record<PositionCode, { pct: number; reviewExpired: boolean }>>,
                }
              : {}),
            ...(card ? { rating: positionAverages(card.values) } : {}),
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')),
    };
  }
}
