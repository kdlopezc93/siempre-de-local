import { Inject, Injectable } from '@nestjs/common';
import type { PositionCode } from '@sdl/domain';
import { asc, eq, inArray } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  ProfileRepository,
  StoredPreferences,
  StoredProfile,
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
          photoKey: playerProfile.photoKey,
        })
        .from(playerProfile)
        .where(eq(playerProfile.userId, userId)),
      db
        .select({ position: playerPreferredPosition.position })
        .from(playerPreferredPosition)
        .where(eq(playerPreferredPosition.userId, userId))
        .orderBy(asc(playerPreferredPosition.rank)),
    ]);
    const { photoKey = null, ...preferences } = row ?? {};
    return {
      preferences: row ? (preferences as StoredPreferences) : null,
      positions: positions.map((p) => p.position),
      photoKey,
    };
  }

  async findMany(userIds: string[]) {
    const result = new Map<string, StoredProfile>();
    if (userIds.length === 0) return result;
    const { db } = this.connection;
    const [rows, positions] = await Promise.all([
      db.select().from(playerProfile).where(inArray(playerProfile.userId, userIds)),
      db
        .select()
        .from(playerPreferredPosition)
        .where(inArray(playerPreferredPosition.userId, userIds))
        .orderBy(asc(playerPreferredPosition.rank)),
    ]);
    for (const id of userIds) result.set(id, { preferences: null, positions: [], photoKey: null });
    for (const { userId, displayName, dominantFoot, playsGoalkeeper, photoKey } of rows) {
      const entry = result.get(userId)!;
      entry.preferences = { displayName, dominantFoot, playsGoalkeeper };
      entry.photoKey = photoKey;
    }
    for (const { userId, position } of positions) result.get(userId)!.positions.push(position);
    return result;
  }

  async setPhotoKey(userId: string, photoKey: string | null, displayName: string) {
    await this.connection.db
      .insert(playerProfile)
      .values({ userId, displayName, photoKey })
      .onConflictDoUpdate({ target: playerProfile.userId, set: { photoKey } });
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
