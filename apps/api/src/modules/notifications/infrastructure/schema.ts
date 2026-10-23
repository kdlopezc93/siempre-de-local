import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '../../identity/infrastructure/schema.js';

/**
 * Dónde mandarle avisos a cada celular (Web Push, D16). Una fila por navegador; se borra al
 * desactivar los avisos, si el servicio de push dice que ya no existe, o con la cuenta.
 */
export const pushSubscription = pgTable('push_subscription', {
  id: uuid()
    .primaryKey()
    .default(sql`uuidv7()`),
  userId: uuid()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  endpoint: text().notNull().unique(),
  p256dh: text().notNull(),
  auth: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
