import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './schema.js';

/**
 * Aceptación de la política de tratamiento de datos (03 §2, Ley 1581). Una fila por
 * versión aceptada: es la prueba de la autorización que el titular puede pedir.
 */
export const dataConsent = pgTable(
  'data_consent',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    policyVersion: text().notNull(),
    acceptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
    /** Declaró ser mayor de 18 al aceptar; sin eso no se guarda. */
    ageConfirmed: boolean().notNull(),
  },
  (t) => [index().on(t.userId), check('data_consent_age_confirmed', sql`${t.ageConfirmed}`)],
);
