import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from '../../identity/infrastructure/schema.js';

/** Quién es el acudiente del niño (escuelas, 2026-11-08). */
export const guardianRelationship = pgEnum('guardian_relationship', [
  'mother',
  'father',
  'guardian',
]);

/**
 * Acudiente y menor (docs/03-modelo-datos.md §2): el acudiente entra con su Google y maneja al
 * menor, que no tiene cuenta. Guarda la autorización del representante legal que aceptó.
 */
export const guardianship = pgTable(
  'guardianship',
  {
    guardianUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    minorUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    relationship: guardianRelationship().notNull(),
    /** La versión de la autorización del representante legal que aceptó. */
    authorizationVersion: text().notNull(),
    authorizedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guardianUserId, t.minorUserId] }), index().on(t.minorUserId)],
);
