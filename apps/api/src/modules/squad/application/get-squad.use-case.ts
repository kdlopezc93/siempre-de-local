import { Inject, Injectable } from '@nestjs/common';
import type { SquadResponse } from '@sdl/contracts';
import { positionAverages } from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
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
  LATEST_RESULTS_QUERY,
  type LatestResultsQuery,
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from './ports/squad.ports.js';
import { assessesIn, testView } from './staff-view.js';

@Injectable()
export class GetSquad {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(ASSESSMENTS_REPOSITORY) private readonly assessments: AssessmentsRepository,
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
  ) {}

  async execute(actor: Actor, teamId: string): Promise<SquadResponse> {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.results.read', { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }

    const players = await this.players.activePlayers(teamId);
    const [profiles, results, latest, assessedByMe, cards] = await Promise.all([
      this.profiles.profilesOf(players.map((p) => ({ id: p.userId, name: p.name }))),
      this.results.latestByTeam(teamId),
      this.assessments.latestByTeam(teamId),
      this.assessments.assessedBy(actor.userId, teamId),
      this.ratings.latestByTeam(teamId),
    ]);
    const assesses = assessesIn(actor, teamId);

    return {
      players: players
        .map((player) => {
          const profile = profiles.get(player.userId)!;
          const result = results.get(player.userId);
          const mine = assessedByMe.has(player.userId);
          const card = cards.get(player.userId);
          const test = testView(result, assesses && !mine);
          return {
            userId: player.userId,
            displayName: profile.displayName,
            jerseyNumber: player.jerseyNumber,
            preferredPositions: profile.preferredPositions,
            test,
            latestAssessment: latest.get(player.userId) ?? null,
            assessedByMe: mine,
            card: card
              ? {
                  ratedAt: card.ratedAt.toISOString(),
                  positionAverages: positionAverages(card.values),
                }
              : null,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es')),
    };
  }
}
