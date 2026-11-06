import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, max, ne } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { session } from '../../identity/infrastructure/schema.js';
import { matchReply, teamMatch } from '../../matches/infrastructure/schema.js';
import { pushSubscription } from '../../notifications/infrastructure/schema.js';
import type { AdoptionRepository } from '../application/ports/adoption.ports.js';

@Injectable()
export class DrizzleAdoptionRepository implements AdoptionRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async lastSeen(userIds: string[]) {
    if (userIds.length === 0) return new Map<string, Date>();
    const rows = await this.connection.db
      .select({ userId: session.userId, at: max(session.updatedAt) })
      .from(session)
      .where(inArray(session.userId, userIds))
      .groupBy(session.userId);
    return new Map(rows.flatMap((r) => (r.at ? [[r.userId, r.at] as const] : [])));
  }

  async withNotices(userIds: string[]) {
    if (userIds.length === 0) return new Set<string>();
    const rows = await this.connection.db
      .selectDistinct({ userId: pushSubscription.userId })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, userIds));
    return new Set(rows.map((r) => r.userId));
  }

  async lastCallUp(teamId: string) {
    const { db } = this.connection;
    const [match] = await db
      .select({ id: teamMatch.id, opponent: teamMatch.opponent, startsAt: teamMatch.startsAt })
      .from(teamMatch)
      .where(and(eq(teamMatch.teamId, teamId), ne(teamMatch.status, 'cancelled')))
      .orderBy(desc(teamMatch.createdAt))
      .limit(1);
    if (!match) return null;
    const replies = await db
      .select({ userId: matchReply.userId })
      .from(matchReply)
      .where(eq(matchReply.matchId, match.id));
    return { ...match, replied: new Set(replies.map((r) => r.userId)) };
  }
}
