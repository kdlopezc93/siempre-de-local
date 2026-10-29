import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  ClubCodeRecord,
  ClubCodesRepository,
} from '../application/ports/club-codes.repository.js';
import { club, clubSignupCode } from './schema.js';

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
