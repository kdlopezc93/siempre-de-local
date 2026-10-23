import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';

import type { DbConnection } from '../../../shared/db/client.js';
import { DB_CONNECTION } from '../../../shared/db/db.module.js';
import type {
  StoredSubscription,
  SubscriptionsRepository,
} from '../application/ports/push.ports.js';
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

  async forget(endpoint: string) {
    await this.connection.db
      .delete(pushSubscription)
      .where(eq(pushSubscription.endpoint, endpoint));
  }
}
