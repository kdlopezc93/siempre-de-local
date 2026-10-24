import { Inject, Injectable } from '@nestjs/common';
import type { PlayerProfileResponse } from '@sdl/contracts';

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
import { toPlayerRating } from '../../ratings/application/ratings.use-cases.js';
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
import { injuryView, testView } from './staff-view.js';

/** Todo lo de un jugador del equipo en una pantalla, para el cuerpo técnico. */
@Injectable()
export class GetPlayerProfile {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(ASSESSMENTS_REPOSITORY) private readonly assessments: AssessmentsRepository,
    @Inject(RATINGS_REPOSITORY) private readonly ratings: RatingsRepository,
    @Inject(KNOWLEDGE_QUERY) private readonly knowledge: KnowledgeQuery,
  ) {}

  async execute(actor: Actor, teamId: string, playerId: string): Promise<PlayerProfileResponse> {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.results.read', { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    const player = (await this.players.activePlayers(teamId)).find((p) => p.userId === playerId);
    if (!player) throw new NotFoundError('Ese jugador no está en el equipo', 'PLAYER_NOT_IN_TEAM');

    const [profiles, results, assessments, assessedByMe, ratings, knowledge, staff] =
      await Promise.all([
        this.profiles.profilesOf([{ id: player.userId, name: player.name }]),
        this.results.latestByTeam(teamId),
        this.assessments.listByTeam(teamId, playerId),
        this.assessments.assessedBy(actor.userId, teamId),
        this.ratings.listByPlayer(teamId, playerId),
        this.knowledge.ofPlayer(playerId),
        this.players.activeStaff(teamId),
      ]);
    const result = results.get(playerId);
    const mine = assessedByMe.has(playerId);
    const canRate = ratableBy(actor, teamId, staff)(playerId);
    const view = testView(result, canRate && !mine);

    return {
      player: { ...profiles.get(playerId)!, userId: playerId, jerseyNumber: player.jerseyNumber },
      test: view.status === 'visible' ? { ...view, ranking: result!.ranking } : view,
      assessments,
      assessedByMe: mine,
      canRate,
      injury: injuryView(player),
      card: ratings[0] ? toPlayerRating(ratings[0]) : null,
      cardCount: ratings.length,
      knowledge,
    };
  }
}
