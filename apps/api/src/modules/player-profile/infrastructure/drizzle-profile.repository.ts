import { Inject, Injectable } from '@nestjs/common';
import type { PositionCode } from '@sdl/domain';
import { asc, eq } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  ProfileRepository,
  StoredPreferences,
} from '../application/ports/profile.repository.js';
import { playerPreferredPosition, playerProfile } from './schema.js';

@Injectable()
export class DrizzleProfileRepository implements ProfileRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async find(userId: string) {
    const { db } = this.connection;
    const [[row], positions] = await Promise.all([
      db
        .select({
          displayName: playerProfile.displayName,
          dominantFoot: playerProfile.dominantFoot,
          playsGoalkeeper: playerProfile.playsGoalkeeper,
        })
        .from(playerProfile)
        .where(eq(playerProfile.userId, userId)),
      db
        .select({ position: playerPreferredPosition.position })
        .from(playerPreferredPosition)
        .where(eq(playerPreferredPosition.userId, userId))
        .orderBy(asc(playerPreferredPosition.rank)),
    ]);
    return { preferences: row ?? null, positions: positions.map((p) => p.position) };
  }

  async savePreferences(userId: string, preferences: StoredPreferences): Promise<void> {
    await this.connection.db
      .insert(playerProfile)
      .values({ userId, ...preferences })
      .onConflictDoUpdate({ target: playerProfile.userId, set: preferences });
  }

  async replacePositions(userId: string, positions: PositionCode[]): Promise<void> {
    await this.connection.db.transaction(async (tx) => {
      await tx.delete(playerPreferredPosition).where(eq(playerPreferredPosition.userId, userId));
      if (positions.length === 0) return;
      await tx
        .insert(playerPreferredPosition)
        .values(positions.map((position, i) => ({ userId, position, rank: i + 1 })));
    });
  }
}
