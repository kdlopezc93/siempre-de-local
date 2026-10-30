import { Inject, Injectable } from '@nestjs/common';
import type { TeamMembersResponse } from '@sdl/contracts';
import { bestBandForTeammates } from '@sdl/domain';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  KNOWLEDGE_QUERY,
  type KnowledgeQuery,
  PROFILES_QUERY,
  type ProfilesQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from './ports/squad.ports.js';

const byName = (a: { displayName: string }, b: { displayName: string }) =>
  a.displayName.localeCompare(b.displayName, 'es');

/** Primero el entrenador, después los asistentes y al final el tesorero. */
const STAFF_ORDER = { coach: 0, assistant: 1, treasurer: 2 } as const;

/**
 * Los integrantes del equipo (07 §4.6), para todos sus miembros: el cuerpo técnico (primero el
 * entrenador) y los jugadores por dorsal, con su mejor banda de conocimiento (D11).
 */
@Injectable()
export class GetTeamMembers {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(TEAM_PLAYERS_QUERY) private readonly members: TeamPlayersQuery,
    @Inject(PROFILES_QUERY) private readonly profiles: ProfilesQuery,
    @Inject(KNOWLEDGE_QUERY) private readonly knowledge: KnowledgeQuery,
  ) {}

  async execute(actor: Actor, teamId: string): Promise<TeamMembersResponse> {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.read', { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    const [coaches, treasurers, players] = await Promise.all([
      this.members.activeStaff(teamId),
      this.members.activeTreasurers(teamId),
      this.members.activePlayers(teamId),
    ]);
    const staff = [...coaches, ...treasurers.map((t) => ({ ...t, role: 'treasurer' as const }))];
    const people = [...staff, ...players].map((p) => ({ id: p.userId, name: p.name }));
    const [profiles, knowledge] = await Promise.all([
      people.length ? this.profiles.profilesOf(people) : new Map(),
      this.knowledge.summaryOf(players.map((p) => p.userId)),
    ]);
    const nameOf = (p: { userId: string; name: string }) =>
      profiles.get(p.userId)?.displayName ?? p.name;
    return {
      staff: staff
        .map((s) => ({ userId: s.userId, displayName: nameOf(s), role: s.role }))
        .sort((a, b) => STAFF_ORDER[a.role] - STAFF_ORDER[b.role] || byName(a, b)),
      players: players
        .map((p) => ({
          userId: p.userId,
          displayName: nameOf(p),
          jerseyNumber: p.jerseyNumber,
          injured: p.injuredAt !== null,
          bestBand: bestBandForTeammates(knowledge.get(p.userId) ?? []),
        }))
        .sort((a, b) => (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) || byName(a, b)),
    };
  }
}
