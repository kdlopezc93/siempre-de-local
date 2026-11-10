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
  VenueRecord,
} from '../application/ports/teams.repository.js';
import { club, clubMembership, team, teamMembership, venue } from './schema.js';

const UNIQUE_VIOLATION = '23505';

/** Drizzle envuelve el error de Postgres en `cause`. */
function isUniqueViolation(error: unknown): boolean {
  const cause =
    error instanceof Error && error.cause instanceof DatabaseError ? error.cause : error;
  return cause instanceof DatabaseError && cause.code === UNIQUE_VIOLATION;
}

/** Las dos columnas de años de nacimiento como un par, o null (2026-11-07). */
function birthYearsOf(row: { birthYearFrom: number | null; birthYearTo: number | null }) {
  return row.birthYearTo !== null ? { from: row.birthYearFrom, to: row.birthYearTo } : null;
}

/** La sede del left join, o null. */
function venueOf(row: { venueId: string | null; venueName: string | null }) {
  return row.venueId && row.venueName !== null ? { id: row.venueId, name: row.venueName } : null;
}

/** Los ajustes en columnas: los años van en dos. */
function settingsColumns({ birthYears, ...rest }: TeamSettings) {
  return {
    ...rest,
    ...(birthYears ? { birthYearFrom: birthYears.from, birthYearTo: birthYears.to } : {}),
  };
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
        birthYearFrom: team.birthYearFrom,
        birthYearTo: team.birthYearTo,
        gender: team.gender,
        venueId: venue.id,
        venueName: venue.name,
        club: { id: club.id, name: club.name, city: club.city, kind: club.kind, sport: club.sport },
        ratingsVisibleToPlayers: team.ratingsVisibleToPlayers,
        matchRatingsVisibleToPlayers: team.matchRatingsVisibleToPlayers,
        colors: team.colors,
        callUpReminders: team.callUpReminders,
      })
      .from(team)
      .innerJoin(club, eq(team.clubId, club.id))
      .leftJoin(venue, eq(team.venueId, venue.id))
      .where(eq(team.id, teamId));
    if (!row) return null;
    const { birthYearFrom, birthYearTo, venueId, venueName, ...rest } = row;
    return {
      ...rest,
      birthYears: birthYearsOf({ birthYearFrom, birthYearTo }),
      venue: venueOf({ venueId, venueName }),
    };
  }

  async updateSettings(teamId: string, settings: TeamSettings) {
    try {
      await this.connection.db
        .update(team)
        .set(settingsColumns(settings))
        .where(eq(team.id, teamId));
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
            colors: team.colors,
          },
          birthYearFrom: team.birthYearFrom,
          birthYearTo: team.birthYearTo,
          club: { id: club.id, name: club.name, kind: club.kind },
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
        .select({ id: club.id, name: club.name, role: clubMembership.role, kind: club.kind })
        .from(clubMembership)
        .innerJoin(club, eq(clubMembership.clubId, club.id))
        .where(eq(clubMembership.userId, userId))
        .orderBy(asc(club.name)),
    ]);

    // Un equipo por entrada, con todos los roles de la persona en él.
    const teams = new Map<string, MeResponse['teams'][number]>();
    for (const row of teamRows) {
      const entry = teams.get(row.team.id) ?? {
        team: {
          ...row.team,
          birthYears:
            row.birthYearTo === null ? null : { from: row.birthYearFrom, to: row.birthYearTo },
        },
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
      .select({ id: club.id, name: club.name, city: club.city, kind: club.kind, sport: club.sport })
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
        birthYearFrom: team.birthYearFrom,
        birthYearTo: team.birthYearTo,
        gender: team.gender,
        venueId: venue.id,
        venueName: venue.name,
        members: countDistinct(teamMembership.userId),
      })
      .from(team)
      .leftJoin(venue, eq(team.venueId, venue.id))
      .leftJoin(
        teamMembership,
        and(eq(teamMembership.teamId, team.id), isNull(teamMembership.leftAt)),
      )
      .where(eq(team.clubId, clubId))
      .groupBy(team.id, venue.id)
      .orderBy(sql`${team.archivedAt} is not null`, asc(team.name));
    return rows.map(({ birthYearFrom, birthYearTo, venueId, venueName, ...row }) => ({
      ...row,
      birthYears: birthYearsOf({ birthYearFrom, birthYearTo }),
      venue: venueOf({ venueId, venueName }),
    }));
  }

  async clubAdmins(clubId: string) {
    return this.connection.db
      .select({ userId: user.id, name: user.name, role: clubMembership.role })
      .from(clubMembership)
      .innerJoin(user, eq(clubMembership.userId, user.id))
      .where(eq(clubMembership.clubId, clubId))
      .orderBy(sql`${clubMembership.role} <> 'owner'`, asc(user.name));
  }

  async clubCandidates(clubId: string) {
    return this.connection.db
      .selectDistinct({ userId: user.id, name: user.name })
      .from(teamMembership)
      .innerJoin(team, and(eq(teamMembership.teamId, team.id), isNull(team.archivedAt)))
      .innerJoin(user, eq(teamMembership.userId, user.id))
      .leftJoin(
        clubMembership,
        and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, user.id)),
      )
      .where(
        and(
          eq(team.clubId, clubId),
          isNull(teamMembership.leftAt),
          isNull(clubMembership.userId),
          // Un menor no maneja la escuela (2026-11-08).
          eq(user.managed, false),
        ),
      )
      .orderBy(asc(user.name));
  }

  async birthYearOf(userId: string): Promise<number | null> {
    const [row] = await this.connection.db
      .select({ birthYear: user.birthYear })
      .from(user)
      .where(eq(user.id, userId));
    return row?.birthYear ?? null;
  }

  async movePlayer(fromTeamId: string, toTeamId: string, userId: string, now: Date) {
    await this.connection.db.transaction(async (tx) => {
      const key = (teamId: string) =>
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.userId, userId),
          eq(teamMembership.role, 'player'),
        );
      await tx
        .update(teamMembership)
        // Si vuelve a este grupo, no vuelve lesionado de hace meses.
        .set({ leftAt: now, injuredAt: null, injuryReturnOn: null })
        .where(and(key(fromTeamId), isNull(teamMembership.leftAt)));
      const [existing] = await tx
        .select({ leftAt: teamMembership.leftAt })
        .from(teamMembership)
        .where(key(toTeamId))
        .for('update');
      if (!existing) {
        await tx
          .insert(teamMembership)
          .values({ teamId: toTeamId, userId, role: 'player', joinedAt: now });
      } else if (existing.leftAt) {
        await tx.update(teamMembership).set({ leftAt: null, joinedAt: now }).where(key(toTeamId));
      }
    });
  }

  async isManaged(userId: string): Promise<boolean> {
    const [row] = await this.connection.db
      .select({ managed: user.managed })
      .from(user)
      .where(eq(user.id, userId));
    return row?.managed ?? false;
  }

  async addClubAdmin(clubId: string, userId: string) {
    await this.connection.db
      .insert(clubMembership)
      .values({ clubId, userId, role: 'admin' })
      .onConflictDoNothing();
  }

  async removeClubAdmin(clubId: string, userId: string) {
    const removed = await this.connection.db
      .delete(clubMembership)
      .where(
        and(
          eq(clubMembership.clubId, clubId),
          eq(clubMembership.userId, userId),
          eq(clubMembership.role, 'admin'),
        ),
      )
      .returning({ userId: clubMembership.userId });
    return removed.length > 0;
  }

  async updateClub(clubId: string, patch: Partial<Pick<ClubRecord, 'name' | 'city'>>) {
    await this.connection.db.update(club).set(patch).where(eq(club.id, clubId));
  }

  async clubVenues(clubId: string) {
    return this.connection.db
      .select({
        id: venue.id,
        name: venue.name,
        address: venue.address,
        teams: count(team.id),
      })
      .from(venue)
      .leftJoin(team, and(eq(team.venueId, venue.id), isNull(team.archivedAt)))
      .where(eq(venue.clubId, clubId))
      .groupBy(venue.id)
      .orderBy(asc(venue.name));
  }

  async schoolCategories(clubId: string) {
    const rows = await this.connection.db
      .select({
        teamId: team.id,
        category: team.category,
        birthYearFrom: team.birthYearFrom,
        birthYearTo: team.birthYearTo,
      })
      .from(team)
      .where(and(eq(team.clubId, clubId), isNull(team.archivedAt)));
    return rows.flatMap(({ teamId, category, birthYearFrom, birthYearTo }) => {
      const years = birthYearsOf({ birthYearFrom, birthYearTo });
      return category && years ? [{ teamId, category, years }] : [];
    });
  }

  async findVenue(venueId: string): Promise<VenueRecord | null> {
    const [row] = await this.connection.db
      .select({ id: venue.id, clubId: venue.clubId, name: venue.name, address: venue.address })
      .from(venue)
      .where(eq(venue.id, venueId));
    return row ?? null;
  }

  async createVenue(clubId: string, input: { name: string; address: string | null }) {
    try {
      const [row] = await this.connection.db
        .insert(venue)
        .values({ clubId, ...input })
        .returning({ id: venue.id });
      return row!;
    } catch (error) {
      if (isUniqueViolation(error)) return 'name-taken' as const;
      throw error;
    }
  }

  async updateVenue(
    clubId: string,
    venueId: string,
    patch: Partial<{ name: string; address: string | null }>,
  ) {
    try {
      const rows = await this.connection.db
        .update(venue)
        .set(patch)
        .where(and(eq(venue.id, venueId), eq(venue.clubId, clubId)))
        .returning({ id: venue.id });
      return rows.length ? ('ok' as const) : ('not-found' as const);
    } catch (error) {
      if (isUniqueViolation(error)) return 'name-taken' as const;
      throw error;
    }
  }

  async deleteVenue(clubId: string, venueId: string) {
    // La FK deja a sus categorías sin sede (`on delete set null`).
    const rows = await this.connection.db
      .delete(venue)
      .where(and(eq(venue.id, venueId), eq(venue.clubId, clubId)))
      .returning({ id: venue.id });
    return rows.length > 0;
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
            birthYearFrom: input.birthYears?.from ?? null,
            birthYearTo: input.birthYears?.to ?? null,
            gender: input.gender,
            venueId: input.venueId,
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

  activeTreasurers(teamId: string) {
    return this.connection.db
      .select({ userId: teamMembership.userId, name: user.name })
      .from(teamMembership)
      .innerJoin(user, eq(teamMembership.userId, user.id))
      .where(
        and(
          eq(teamMembership.teamId, teamId),
          eq(teamMembership.role, 'treasurer'),
          isNull(teamMembership.leftAt),
        ),
      );
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
