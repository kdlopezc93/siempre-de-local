import { Inject, Injectable } from '@nestjs/common';
import type { MeResponse } from '@sdl/contracts';
import { and, asc, count, countDistinct, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DatabaseError } from 'pg';

import type { AuthorizationReader } from '../../../shared/authz/actor.port.js';
import type { ClubRole, TeamRole } from '../../../shared/authz/policy.js';
import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type { MembershipsQuery } from '../../identity/application/ports/memberships.query.js';
import { user } from '../../identity/infrastructure/schema.js';
import type { TeamPlayersQuery } from '../../squad/application/ports/squad.ports.js';
import type {
  ClubRecord,
  ClubTeamRecord,
  CreateTeamOutcome,
  NewTeam,
  RoleChange,
  TeamRecord,
  TeamSettings,
  TeamsRepository,
} from '../application/ports/teams.repository.js';
import { club, clubMembership, team, teamMembership } from './schema.js';

const UNIQUE_VIOLATION = '23505';

/** Drizzle envuelve el error de Postgres en `cause`. */
function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error;
  return cause instanceof DatabaseError && cause.code === UNIQUE_VIOLATION;
}

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
        formats: team.formats,
        season: team.season,
        category: team.category,
        club: { id: club.id, name: club.name, city: club.city },
        ratingsVisibleToPlayers: team.ratingsVisibleToPlayers,
        matchRatingsVisibleToPlayers: team.matchRatingsVisibleToPlayers,
      })
      .from(team)
      .innerJoin(club, eq(team.clubId, club.id))
      .where(eq(team.id, teamId));
    return row ?? null;
  }

  async updateSettings(teamId: string, settings: TeamSettings) {
    try {
      await this.connection.db.update(team).set(settings).where(eq(team.id, teamId));
      return 'ok' as const;
    } catch (error) {
      if (isUniqueViolation(error)) return 'name-taken' as const;
      throw error;
    }
  }

  async setJerseyNumber(teamId: string, userId: string, jerseyNumber: number | null) {
    const updated = await this.connection.db
      .update(teamMembership)
      .set({ jerseyNumber })
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.userId, userId),
          eq(teamMembership.role, 'player'),
          isNull(teamMembership.leftAt),
        ),
      )
      .returning({ userId: teamMembership.userId });
    return updated.length > 0;
  }

  async setInjury(
    teamId: string,
    userId: string,
    injury: { injuredAt: Date; returnOn: string | null } | null,
  ) {
    const updated = await this.connection.db
      .update(teamMembership)
      .set(
        injury
          ? { injuredAt: injury.injuredAt, injuryReturnOn: injury.returnOn }
          : { injuredAt: null, injuryReturnOn: null },
      )
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.userId, userId),
          eq(teamMembership.role, 'player'),
          isNull(teamMembership.leftAt),
        ),
      )
      .returning({ userId: teamMembership.userId });
    return updated.length > 0;
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
      // Un equipo archivado no da permisos a sus integrantes (2026-10-29).
      db
        .select({ teamId: teamMembership.teamId, role: teamMembership.role })
        .from(teamMembership)
        .innerJoin(team, and(eq(teamMembership.teamId, team.id), isNull(team.archivedAt)))
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
          team: {
            id: team.id,
            name: team.name,
            format: team.format,
            formats: team.formats,
            season: team.season,
          },
          club: { id: club.id, name: club.name },
          role: teamMembership.role,
          jerseyNumber: teamMembership.jerseyNumber,
          injuredAt: teamMembership.injuredAt,
          injuryReturnOn: teamMembership.injuryReturnOn,
        })
        .from(teamMembership)
        // Los archivados no se listan (2026-10-29).
        .innerJoin(team, and(eq(teamMembership.teamId, team.id), isNull(team.archivedAt)))
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
      const entry = teams.get(row.team.id) ?? {
        team: row.team,
        club: row.club,
        roles: [],
        jerseyNumber: null,
        injury: null,
      };
      entry.roles.push(row.role);
      // El dorsal y la lesión son de la fila de jugador.
      if (row.role === 'player') {
        entry.jerseyNumber = row.jerseyNumber;
        entry.injury = injuryOf(row);
      }
      teams.set(row.team.id, entry);
    }
    return { teams: [...teams.values()], clubs: clubRows };
  }

  async activeRoles(teamId: string, userId: string): Promise<TeamRole[]> {
    const rows = await this.connection.db
      .select({ role: teamMembership.role })
      .from(teamMembership)
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.userId, userId),
          isNull(teamMembership.leftAt),
        ),
      );
    return rows.map((r) => r.role);
  }

  async activeCoaches(teamId: string): Promise<string[]> {
    const rows = await this.connection.db
      .select({ userId: teamMembership.userId })
      .from(teamMembership)
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.role, 'coach'),
          isNull(teamMembership.leftAt),
        ),
      );
    return rows.map((r) => r.userId);
  }

  async changeRoles(teamId: string, changes: RoleChange[], now: Date): Promise<void> {
    await this.connection.db.transaction(async (tx) => {
      for (const { userId, role, active } of changes) {
        const key = and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.userId, userId),
          eq(teamMembership.role, role),
        );
        if (!active) {
          await tx
            .update(teamMembership)
            .set({ leftAt: now })
            .where(and(key, isNull(teamMembership.leftAt)));
          continue;
        }
        const [existing] = await tx
          .select({ leftAt: teamMembership.leftAt })
          .from(teamMembership)
          .where(key)
          .for('update');
        if (!existing) {
          await tx.insert(teamMembership).values({ teamId, userId, role, joinedAt: now });
        } else if (existing.leftAt) {
          await tx.update(teamMembership).set({ leftAt: null, joinedAt: now }).where(key);
        }
      }
    });
  }

  async findClub(clubId: string): Promise<ClubRecord | null> {
    const [row] = await this.connection.db
      .select({ id: club.id, name: club.name, city: club.city })
      .from(club)
      .where(eq(club.id, clubId));
    return row ?? null;
  }

  async clubTeams(clubId: string): Promise<ClubTeamRecord[]> {
    const rows = await this.connection.db
      .select({
        id: team.id,
        name: team.name,
        category: team.category,
        format: team.format,
        season: team.season,
        archived: sql<boolean>`${team.archivedAt} is not null`,
        members: countDistinct(teamMembership.userId),
      })
      .from(team)
      .leftJoin(
        teamMembership,
        and(eq(teamMembership.teamId, team.id), isNull(teamMembership.leftAt)),
      )
      .where(eq(team.clubId, clubId))
      .groupBy(team.id)
      .orderBy(sql`${team.archivedAt} is not null`, asc(team.name));
    return rows;
  }

  async updateClub(clubId: string, patch: Partial<Pick<ClubRecord, 'name' | 'city'>>) {
    await this.connection.db.update(club).set(patch).where(eq(club.id, clubId));
  }

  async setArchived(
    clubId: string,
    teamId: string,
    archived: boolean,
    maxActive: number,
    now: Date,
  ): Promise<'ok' | 'limit' | 'not-found'> {
    return this.connection.db.transaction(async (tx) => {
      // Bloquea el club: desarchivar dos a la vez no pasa del límite.
      await tx.select({ id: club.id }).from(club).where(eq(club.id, clubId)).for('update');
      const [found] = await tx
        .select({ archivedAt: team.archivedAt })
        .from(team)
        .where(and(eq(team.id, teamId), eq(team.clubId, clubId)));
      if (!found) return 'not-found';
      if ((found.archivedAt !== null) === archived) return 'ok';
      if (!archived) {
        const [active] = await tx
          .select({ n: count() })
          .from(team)
          .where(and(eq(team.clubId, clubId), isNull(team.archivedAt)));
        if (active!.n >= maxActive) return 'limit';
      }
      await tx
        .update(team)
        .set({ archivedAt: archived ? now : null })
        .where(eq(team.id, teamId));
      return 'ok';
    });
  }

  async createTeam(
    clubId: string,
    userId: string,
    input: NewTeam,
    maxActive: number,
    now: Date,
  ): Promise<CreateTeamOutcome> {
    try {
      return await this.connection.db.transaction(async (tx) => {
        await tx.select({ id: club.id }).from(club).where(eq(club.id, clubId)).for('update');
        const [active] = await tx
          .select({ n: count() })
          .from(team)
          .where(and(eq(team.clubId, clubId), isNull(team.archivedAt)));
        if (active!.n >= maxActive) return 'limit' as const;
        const [created] = await tx
          .insert(team)
          .values({
            clubId,
            name: input.name,
            category: input.category,
            format: input.format,
            formats: [input.format],
            season: input.season,
          })
          .returning({ id: team.id });
        const teamId = created!.id;
        await tx
          .insert(teamMembership)
          .values([
            { teamId, userId, role: 'coach', joinedAt: now },
            ...(input.alsoPlays
              ? [{ teamId, userId, role: 'player' as const, joinedAt: now }]
              : []),
          ]);
        return { teamId };
      });
    } catch (error) {
      if (isUniqueViolation(error)) return 'name-taken';
      throw error;
    }
  }

  async activeStaff(teamId: string) {
    const rows = await this.connection.db
      .select({ userId: teamMembership.userId, name: user.name, role: teamMembership.role })
      .from(teamMembership)
      .innerJoin(user, eq(teamMembership.userId, user.id))
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          inArray(teamMembership.role, ['coach', 'assistant']),
          isNull(teamMembership.leftAt),
        ),
      );
    return rows as { userId: string; name: string; role: 'coach' | 'assistant' }[];
  }

  activePlayers(teamId: string) {
    return this.connection.db
      .select({
        userId: teamMembership.userId,
        name: user.name,
        jerseyNumber: teamMembership.jerseyNumber,
        injuredAt: teamMembership.injuredAt,
        injuryReturnOn: teamMembership.injuryReturnOn,
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

/** La lesión de una fila de jugador, como la ve la app. */
function injuryOf(row: { injuredAt: Date | null; injuryReturnOn: string | null }) {
  return row.injuredAt
    ? { since: row.injuredAt.toISOString(), returnOn: row.injuryReturnOn }
    : null;
}
