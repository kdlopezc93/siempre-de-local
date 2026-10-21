import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import type { AuthorizationReader } from '../../../shared/authz/actor.port.js';
import type { ClubRole, TeamRole } from '../../../shared/authz/policy.js';
import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type { TeamRecord, TeamsRepository } from '../application/ports/teams.repository.js';
import { club, clubMembership, team, teamMembership } from './schema.js';

@Injectable()
export class DrizzleTeamsRepository implements TeamsRepository, AuthorizationReader {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async findById(teamId: string): Promise<TeamRecord | null> {
    const [row] = await this.connection.db
      .select({
        id: team.id,
        name: team.name,
        format: team.format,
        season: team.season,
        club: { id: club.id, name: club.name },
      })
      .from(team)
      .innerJoin(club, eq(team.clubId, club.id))
      .where(eq(team.id, teamId));
    return row ?? null;
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
}
