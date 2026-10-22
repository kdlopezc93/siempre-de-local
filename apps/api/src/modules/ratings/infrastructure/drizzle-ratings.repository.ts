import { Inject, Injectable } from '@nestjs/common';
import type { RatingAttributeCode, RatingValues } from '@sdl/domain';
import { and, desc, eq, inArray } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import { user } from '../../identity/infrastructure/schema.js';
import type {
  NewRating,
  RatingsRepository,
  StoredRating,
} from '../application/ports/ratings.repository.js';
import { playerRating, playerRatingValue } from './schema.js';

@Injectable()
export class DrizzleRatingsRepository implements RatingsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async create({ teamId, playerUserId, ratedBy, values, notes }: NewRating) {
    const id = await this.connection.db.transaction(async (tx) => {
      const [row] = (await tx
        .insert(playerRating)
        .values({ teamId, playerUserId, ratedBy, notes })
        .returning({ id: playerRating.id })) as [{ id: string }];
      await tx.insert(playerRatingValue).values(
        Object.entries(values).map(([attributeCode, value]) => ({
          ratingId: row.id,
          attributeCode,
          value: value!,
        })),
      );
      return row.id;
    });
    const [saved] = await this.load(eq(playerRating.id, id));
    return saved!;
  }

  listByPlayer(teamId: string, playerUserId: string) {
    return this.load(
      and(eq(playerRating.teamId, teamId), eq(playerRating.playerUserId, playerUserId)),
    );
  }

  async latestByTeam(teamId: string) {
    const latest = new Map<string, StoredRating>();
    // Ya vienen de la más reciente a la más antigua: se queda la primera de cada jugador.
    for (const rating of await this.load(eq(playerRating.teamId, teamId))) {
      if (!latest.has(rating.playerId)) latest.set(rating.playerId, rating);
    }
    return latest;
  }

  /** Las fotos que cumplen `where`, de la más reciente a la más antigua, con sus valores. */
  private async load(where: ReturnType<typeof eq> | undefined): Promise<StoredRating[]> {
    const { db } = this.connection;
    const rows = await db
      .select({
        id: playerRating.id,
        playerId: playerRating.playerUserId,
        raterId: playerRating.ratedBy,
        raterName: user.name,
        ratedAt: playerRating.ratedAt,
        source: playerRating.source,
        notes: playerRating.notes,
      })
      .from(playerRating)
      .leftJoin(user, eq(playerRating.ratedBy, user.id))
      .where(where)
      .orderBy(desc(playerRating.ratedAt), desc(playerRating.id));
    if (rows.length === 0) return [];
    const valueRows = await db
      .select()
      .from(playerRatingValue)
      .where(
        inArray(
          playerRatingValue.ratingId,
          rows.map((r) => r.id),
        ),
      );
    const values = new Map<string, Partial<Record<RatingAttributeCode, number>>>();
    for (const { ratingId, attributeCode, value } of valueRows) {
      const entry = values.get(ratingId) ?? {};
      entry[attributeCode as RatingAttributeCode] = value;
      values.set(ratingId, entry);
    }
    return rows.map(({ raterId, raterName, ...row }) => ({
      ...row,
      ratedBy: raterId ? { id: raterId, name: raterName ?? '' } : null,
      values: (values.get(row.id) ?? {}) as RatingValues,
    }));
  }
}
