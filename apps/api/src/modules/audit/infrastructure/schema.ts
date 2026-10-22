import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/** Quién hizo qué y cuándo (docs/03-modelo-datos.md · audit_log). Solo se agregan filas. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** Null si se borró la cuenta: la fila se conserva. */
    actorUserId: uuid().references(() => user.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text().notNull(),
    teamId: uuid().references(() => team.id),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    meta: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [index().on(t.teamId, t.at.desc()), index().on(t.actorUserId, t.at.desc())],
);
