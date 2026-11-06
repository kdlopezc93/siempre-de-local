import { Inject, Injectable } from '@nestjs/common';
import type { AdoptionResponse } from '@sdl/contracts';
import { seenBucket } from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  LATEST_RESULTS_QUERY,
  type LatestResultsQuery,
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from '../../squad/application/ports/squad.ports.js';
import { ADOPTION_REPOSITORY, type AdoptionRepository } from './ports/adoption.ports.js';

/**
 * La app en el equipo (2026-11-06, Kevin): quién la usa y a quién recordarle. Solo rangos
 * ("esta semana" o "antes"), nunca la hora ni qué hizo cada uno (política de datos §4). Lo ven el
 * cuerpo técnico y los administradores del club, como los resultados del equipo.
 */
@Injectable()
export class GetAdoption {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(ADOPTION_REPOSITORY) private readonly adoption: AdoptionRepository,
  ) {}

  async execute(actor: Actor, teamId: string, now = new Date()): Promise<AdoptionResponse> {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.results.read', { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    const players = await this.players.activePlayers(teamId);
    const ids = players.map((p) => p.userId);
    const [profiles, results, seen, notices, callUp] = await Promise.all([
      this.profiles.profilesOf(players.map((p) => ({ id: p.userId, name: p.name }))),
      this.results.latestByTeam(teamId),
      this.adoption.lastSeen(ids),
      this.adoption.withNotices(ids),
      this.adoption.lastCallUp(teamId),
    ]);
    return {
      players: players
        .map((p) => ({
          userId: p.userId,
          displayName: profiles.get(p.userId)?.displayName ?? p.name,
          jerseyNumber: p.jerseyNumber,
          seen: seenBucket(seen.get(p.userId) ?? null, now),
          notices: notices.has(p.userId),
          testDone: results.has(p.userId),
          // El lesionado no tiene que responder (como en la convocatoria).
          repliedLast: callUp && !p.injuredAt ? callUp.replied.has(p.userId) : null,
        }))
        .sort(
          (a, b) =>
            (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
            a.displayName.localeCompare(b.displayName, 'es'),
        ),
      lastCallUp: callUp
        ? { id: callUp.id, opponent: callUp.opponent, startsAt: callUp.startsAt.toISOString() }
        : null,
    };
  }
}
