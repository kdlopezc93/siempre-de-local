import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/** Dónde ve el cuerpo técnico a cada jugador (docs/03-modelo-datos.md §8). */
export const coachAssessment = pgTable(
  'coach_assessment',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    playerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Null si se borró la cuenta de quien valoró. */
    coachUserId: uuid().references(() => user.id, { onDelete: 'set null' }),
    primaryPosition: positionCode().notNull(),
    secondaryPositions: positionCode()
      .array()
      .notNull()
      .default(sql`'{}'`),
    confidence: smallint().notNull(),
    /** Hecha sin haber visto el test del jugador: la que vale para validar el test (02 §11). */
    blind: boolean().notNull(),
    notes: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.teamId, t.playerUserId, t.createdAt.desc()),
    check('coach_assessment_confidence', sql`${t.confidence} between 1 and 5`),
    check('coach_assessment_secondary', sql`cardinality(${t.secondaryPositions}) <= 2`),
  ],
);
