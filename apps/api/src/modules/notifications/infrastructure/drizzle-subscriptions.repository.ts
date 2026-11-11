import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  StoredSubscription,
  SubscriptionsRepository,
} from '../application/ports/push.ports.js';
import { guardianship } from '../../families/infrastructure/schema.js';
import { user } from '../../identity/infrastructure/schema.js';
import { pushSubscription } from './schema.js';

@Injectable()
export class DrizzleSubscriptionsRepository implements SubscriptionsRepository {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async save(userId: string, s: StoredSubscription) {
    await this.connection.db
      .insert(pushSubscription)
      .values({ userId, ...s })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId, p256dh: s.p256dh, auth: s.auth },
      });
  }

  async remove(userId: string, endpoint: string) {
    await this.connection.db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
  }

  async removeAll(userId: string) {
    await this.connection.db.delete(pushSubscription).where(eq(pushSubscription.userId, userId));
  }

  async forUsers(userIds: readonly string[]) {
    if (userIds.length === 0) return [];
    return this.connection.db
      .select({
        endpoint: pushSubscription.endpoint,
        p256dh: pushSubscription.p256dh,
        auth: pushSubscription.auth,
      })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, [...userIds]));
  }

  async guardiansOf(userIds: readonly string[]) {
    if (userIds.length === 0) return [];
    return this.connection.db
      .select({
        minorId: guardianship.minorUserId,
        minorName: user.name,
        guardianId: guardianship.guardianUserId,
      })
      .from(guardianship)
      .innerJoin(user, eq(guardianship.minorUserId, user.id))
      .where(inArray(guardianship.minorUserId, [...userIds]));
  }

  async forget(endpoint: string) {
    await this.connection.db
      .delete(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint));
  }
}
