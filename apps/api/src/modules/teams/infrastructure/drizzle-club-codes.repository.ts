import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, like, or, type SQL } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  ClubCodeRecord,
  ClubCodesRepository,
  CreateClubOutcome,
  NewClub,
} from '../application/ports/club-codes.repository.js';
import { club, clubMembership, clubSignupCode, team, teamMembership } from './schema.js';

/** Dueño de un solo club (Kevin, 2026-10-29); más, cuando haya plan pago. */
const CLUBS_PER_OWNER = 1;

/** "Los del Barrio FC" → "los-del-barrio-fc": sin tildes, minúsculas y guiones. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'club';
}

@Injectable()
export class DrizzleClubCodesRepository implements ClubCodesRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async create(input: Parameters<ClubCodesRepository['create']>[0]): Promise<ClubCodeRecord> {
    const [row] = await this.connection.db
      .insert(clubSignupCode)
      .values(input)
      .returning({ id: clubSignupCode.id });
    return (await this.find(row!.id))!;
  }

  list(): Promise<ClubCodeRecord[]> {
    return this.load();
  }

  async find(id: string): Promise<ClubCodeRecord | null> {
    const [row] = await this.load(eq(clubSignupCode.id, id));
    return row ?? null;
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.connection.db
      .update(clubSignupCode)
      .set({ revokedAt: at })
      .where(and(eq(clubSignupCode.id, id), isNull(clubSignupCode.revokedAt)));
  }

  async findByCodeHash(codeHash: string): Promise<ClubCodeRecord | null> {
    const [row] = await this.load(eq(clubSignupCode.codeHash, codeHash));
    return row ?? null;
  }

  createClub(
    codeId: string,
    userId: string,
    input: NewClub,
    now: Date,
  ): Promise<CreateClubOutcome> {
    return this.connection.db.transaction(async (tx) => {
      // Gasta el código solo si todavía sirve: dos personas no crean dos clubes con él.
      const [code] = await tx
        .select({ id: clubSignupCode.id })
        .from(clubSignupCode)
        .where(
          and(
            eq(clubSignupCode.id, codeId),
            isNull(clubSignupCode.usedAt),
            isNull(clubSignupCode.revokedAt),
            gt(clubSignupCode.expiresAt, now),
          ),
        )
        .for('update');
      if (!code) return 'unavailable';

      const [owned] = await tx
        .select({ n: count() })
        .from(clubMembership)
        .where(and(eq(clubMembership.userId, userId), eq(clubMembership.role, 'owner')));
      if (owned!.n >= CLUBS_PER_OWNER) return 'limit';

      const base = slugify(input.clubName);
      const taken = new Set(
        (
          await tx
            .select({ slug: club.slug })
            .from(club)
            .where(or(eq(club.slug, base), like(club.slug, `${base}-%`)))
        ).map((r) => r.slug),
      );
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

      const [created] = await tx
        .insert(club)
        .values({ name: input.clubName, slug, city: input.city })
        .returning({ id: club.id });
      const clubId = created!.id;
      await tx.insert(clubMembership).values({ clubId, userId, role: 'owner' });
      const [createdTeam] = await tx
        .insert(team)
        .values({
          clubId,
          name: input.teamName,
          category: input.category,
          format: input.format,
          formats: [input.format],
          season: input.season,
        })
        .returning({ id: team.id });
      const teamId = createdTeam!.id;
      await tx
        .insert(teamMembership)
        .values([
          { teamId, userId, role: 'coach', joinedAt: now },
          ...(input.alsoPlays ? [{ teamId, userId, role: 'player' as const, joinedAt: now }] : []),
        ]);
      await tx
        .update(clubSignupCode)
        .set({ usedAt: now, usedBy: userId, clubId })
        .where(eq(clubSignupCode.id, codeId));
      return { clubId, teamId };
    });
  }

  /** Los códigos que cumplen `where`, del más reciente al más antiguo, con su club. */
  private async load(where?: SQL): Promise<ClubCodeRecord[]> {
    const rows = await this.connection.db
      .select({
        id: clubSignupCode.id,
        note: clubSignupCode.note,
        expiresAt: clubSignupCode.expiresAt,
        usedAt: clubSignupCode.usedAt,
        revokedAt: clubSignupCode.revokedAt,
        createdAt: clubSignupCode.createdAt,
        clubId: club.id,
        clubName: club.name,
      })
      .from(clubSignupCode)
      .leftJoin(club, eq(clubSignupCode.clubId, club.id))
      .where(where)
      .orderBy(desc(clubSignupCode.createdAt), desc(clubSignupCode.id));
    return rows.map(({ clubId, clubName, ...row }) => ({
      ...row,
      club: clubId && clubName !== null ? { id: clubId, name: clubName } : null,
    }));
  }
}
