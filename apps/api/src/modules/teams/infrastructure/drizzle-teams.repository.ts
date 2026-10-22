import { Inject, Injectable } from '@nestjs/common';
import type { MeResponse } from '@sdl/contracts';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { AuthorizationReader } from '../../../shared/authz/actor.port.js';
import type { ClubRole, TeamRole } from '../../../shared/authz/policy.js';
import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type { MembershipsQuery } from '../../identity/application/ports/memberships.query.js';
import { user } from '../../identity/infrastructure/schema.js';
import type { TeamPlayersQuery } from '../../squad/application/ports/squad.ports.js';
import type { TeamRecord, TeamsRepository } from '../application/ports/teams.repository.js';
import { club, clubMembership, team, teamMembership } from './schema.js';

@Injectable()
export class DrizzleTeamsRepository
  implements TeamsRepository, AuthorizationReader, MembershipsQuery, TeamPlayersQuery
{
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async findById(teamId: string): Promise<TeamRecord | null> {
    const [row] = await this.connection.db
      .select({
        id: team.id,
        name: team.name,
        format: team.format,
        season: team.season,
        club: { id: club.id, name: club.name },
        ratingsVisibleToPlayers: team.ratingsVisibleToPlayers,
      })
      .from(team)
      .innerJoin(club, eq(team.clubId, club.id))
      .where(eq(team.id, teamId));
    return row ?? null;
  }

  async updateSettings(teamId: string, settings: { ratingsVisibleToPlayers: boolean }) {
    await this.connection.db.update(team).set(settings).where(eq(team.id, teamId));
  }

  async findTeamClubId(teamId: string): Promise<string | null> {
    const [row] = await this.connection.db
      .select({ clubId: team.clubId })
      .from(team)
      .where(eq(team.id, teamId));
    return row?.clubId ?? null;
  }

  async loadMemberships(userId: string) {
    const { db } = this.connection;
    const [clubRows, teamRows] = await Promise.all([
      db
        .select({ clubId: clubMembership.clubId, role: clubMembership.role })
        .from(clubMembership)
        .where(eq(clubMembership.userId, userId)),
      db
        .select({ teamId: teamMembership.teamId, role: teamMembership.role })
        .from(teamMembership)
        .where(and(eq(teamMembership.userId, userId), isNull(teamMembership.leftAt))),
    ]);

    const teams = new Map<string, TeamRole[]>();
    for (const { teamId, role } of teamRows)
      teams.set(teamId, [...(teams.get(teamId) ?? []), role]);
    return {
      clubs: new Map<string, ClubRole>(clubRows.map((row) => [row.clubId, row.role])),
      teams,
    };
  }

  async listForUser(userId: string): Promise<Pick<MeResponse, 'teams' | 'clubs'>> {
    const { db } = this.connection;
    const [teamRows, clubRows] = await Promise.all([
      db
        .select({
          team: { id: team.id, name: team.name, format: team.format, season: team.season },
          club: { id: club.id, name: club.name },
          role: teamMembership.role,
        })
        .from(teamMembership)
        .innerJoin(team, eq(teamMembership.teamId, team.id))
        .innerJoin(club, eq(team.clubId, club.id))
        .where(and(eq(teamMembership.userId, userId), isNull(teamMembership.leftAt)))
        .orderBy(asc(team.name), asc(teamMembership.role)),
      db
        .select({ id: club.id, name: club.name, role: clubMembership.role })
        .from(clubMembership)
        .innerJoin(club, eq(clubMembership.clubId, club.id))
        .where(eq(clubMembership.userId, userId))
        .orderBy(asc(club.name)),
    ]);

    // Un equipo por entrada, con todos los roles de la persona en él.
    const teams = new Map<string, MeResponse['teams'][number]>();
    for (const row of teamRows) {
      const entry = teams.get(row.team.id) ?? { team: row.team, club: row.club, roles: [] };
      entry.roles.push(row.role);
      teams.set(row.team.id, entry);
    }
    return { teams: [...teams.values()], clubs: clubRows };
  }

  activePlayers(teamId: string) {
    return this.connection.db
      .select({
        userId: teamMembership.userId,
        name: user.name,
        jerseyNumber: teamMembership.jerseyNumber,
      })
      .from(teamMembership)
      .innerJoin(user, eq(teamMembership.userId, user.id))
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.role, 'player'),
          isNull(teamMembership.leftAt),
        ),
      );
  }
}
