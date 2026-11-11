import { Inject, Injectable } from '@nestjs/common';
import type { Child } from '@sdl/contracts';
import { categoryKey } from '@sdl/domain';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type { ChildrenQuery } from '../../identity/application/ports/children.query.js';
import { user } from '../../identity/infrastructure/schema.js';
import { club, team, teamMembership } from '../../teams/infrastructure/schema.js';
import type { FamiliesRepository, NewMinor } from '../application/ports/families.repository.js';
import { guardianship } from './schema.js';

/**
 * El correo del menor: interno y único, en un dominio que no existe (`.invalid`, RFC 2606).
 * Better Auth exige uno; nunca se usa para escribirle ni para entrar.
 */
const minorEmail = () => `menor-${crypto.randomUUID()}@menor.invalid`;

@Injectable()
export class DrizzleFamiliesRepository implements FamiliesRepository, ChildrenQuery {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async findChild(guardianUserId: string, name: string, birthYear: number) {
    const rows = await this.connection.db
      .select({ id: user.id, name: user.name })
      .from(guardianship)
      .innerJoin(user, eq(guardianship.minorUserId, user.id))
      .where(and(eq(guardianship.guardianUserId, guardianUserId), eq(user.birthYear, birthYear)));
    const key = categoryKey(name);
    return rows.find((r) => categoryKey(r.name) === key)?.id ?? null;
  }

  createMinor(minor: NewMinor): Promise<string> {
    return this.connection.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(user)
        .values({
          name: minor.name,
          email: minorEmail(),
          managed: true,
          birthYear: minor.birthYear,
        })
        .returning({ id: user.id });
      await tx.insert(guardianship).values({
        guardianUserId: minor.guardianUserId,
        minorUserId: created!.id,
        relationship: minor.relationship,
        authorizationVersion: minor.authorizationVersion,
        authorizedAt: minor.at,
      });
      return created!.id;
    });
  }

  async isGuardianOf(guardianUserId: string, minorUserId: string) {
    const rows = await this.connection.db
      .select({ minor: guardianship.minorUserId })
      .from(guardianship)
      .where(
        and(
          eq(guardianship.guardianUserId, guardianUserId),
          eq(guardianship.minorUserId, minorUserId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async childrenOf(guardianUserId: string): Promise<Child[]> {
    const rows = await this.connection.db
      .select({
        id: user.id,
        name: user.name,
        birthYear: user.birthYear,
        relationship: guardianship.relationship,
        teamId: team.id,
        teamName: team.name,
        clubId: club.id,
        clubName: club.name,
        clubKind: club.kind,
      })
      .from(guardianship)
      .innerJoin(user, eq(guardianship.minorUserId, user.id))
      .leftJoin(
        teamMembership,
        and(eq(teamMembership.userId, user.id), isNull(teamMembership.leftAt)),
      )
      // Los archivados no se listan, como en /me.
      .leftJoin(team, and(eq(teamMembership.teamId, team.id), isNull(team.archivedAt)))
      .leftJoin(club, eq(team.clubId, club.id))
      .where(eq(guardianship.guardianUserId, guardianUserId))
      .orderBy(asc(user.name), asc(team.name));
    const children = new Map<string, Child>();
    for (const row of rows) {
      const child = children.get(row.id) ?? {
        id: row.id,
        name: row.name,
        birthYear: row.birthYear ?? 0,
        relationship: row.relationship,
        teams: [],
      };
      if (row.teamId && row.teamName && row.clubId && row.clubName && row.clubKind) {
        if (!child.teams.some((t) => t.team.id === row.teamId)) {
          child.teams.push({
            team: { id: row.teamId, name: row.teamName },
            club: { id: row.clubId, name: row.clubName, kind: row.clubKind },
          });
        }
      }
      children.set(row.id, child);
    }
    return [...children.values()];
  }
}
