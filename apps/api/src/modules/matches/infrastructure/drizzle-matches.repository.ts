import { Inject, Injectable } from '@nestjs/common';
import type { MatchReply } from '@sdl/contracts';
import { asc, and, eq, inArray } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type { MatchesRepository, MatchRecord } from '../application/ports/matches.repository.js';
import { matchReply, teamMatch } from './schema.js';

@Injectable()
export class DrizzleMatchesRepository implements MatchesRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  private select() {
    return this.connection.db
      .select({
        id: teamMatch.id,
        teamId: teamMatch.teamId,
        format: teamMatch.format,
        startsAt: teamMatch.startsAt,
        place: teamMatch.place,
        opponent: teamMatch.opponent,
        status: teamMatch.status,
        lineupId: teamMatch.lineupId,
        publishedAt: teamMatch.publishedAt,
        creatorId: user.id,
        creatorName: user.name,
      })
      .from(teamMatch)
      .leftJoin(user, eq(teamMatch.createdBy, user.id));
  }

  private toRecord(
    row: Awaited<ReturnType<DrizzleMatchesRepository['select']>>[number],
  ): MatchRecord {
    const { creatorId, creatorName, ...rest } = row;
    return { ...rest, createdBy: creatorId ? { id: creatorId, name: creatorName! } : null };
  }

  async create(
    teamId: string,
    createdBy: string,
    data: Pick<MatchRecord, 'format' | 'startsAt' | 'place' | 'opponent'>,
  ) {
    const [row] = await this.connection.db
      .insert(teamMatch)
      .values({ teamId, createdBy, ...data })
      .returning({ id: teamMatch.id });
    return row!.id;
  }

  async find(teamId: string, matchId: string) {
    const [row] = await this.select().where(
      and(eq(teamMatch.teamId, teamId), eq(teamMatch.id, matchId)),
    );
    return row ? this.toRecord(row) : null;
  }

  async listByTeam(teamId: string) {
    const rows = await this.select()
      .where(eq(teamMatch.teamId, teamId))
      .orderBy(asc(teamMatch.startsAt));
    return rows.map((row) => this.toRecord(row));
  }

  async update(
    matchId: string,
    patch: Partial<Pick<MatchRecord, 'format' | 'startsAt' | 'place' | 'opponent' | 'status'>>,
  ) {
    await this.connection.db.update(teamMatch).set(patch).where(eq(teamMatch.id, matchId));
  }

  async replies(matchIds: string[]) {
    const result = new Map<string, Map<string, MatchReply>>(matchIds.map((id) => [id, new Map()]));
    if (matchIds.length === 0) return result;
    const rows = await this.connection.db
      .select()
      .from(matchReply)
      .where(inArray(matchReply.matchId, matchIds));
    for (const row of rows) result.get(row.matchId)!.set(row.userId, row.reply);
    return result;
  }

  /** MatchGateway (para alineaciones): marcarla publicada. */
  async publish(matchId: string, lineupId: string, at: Date) {
    await this.connection.db
      .update(teamMatch)
      .set({ lineupId, publishedAt: at })
      .where(eq(teamMatch.id, matchId));
  }

  async setReply(matchId: string, userId: string, reply: MatchReply) {
    await this.connection.db
      .insert(matchReply)
      .values({ matchId, userId, reply })
      .onConflictDoUpdate({
        target: [matchReply.matchId, matchReply.userId],
        set: { reply, repliedAt: new Date() },
      });
  }
}
