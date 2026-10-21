import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { matchFormat, positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { questionnaireVersion } from '../../questionnaires/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/**
 * Intentos del test de orientación (docs/03-modelo-datos.md §5). Se guardan las
 * respuestas crudas (qué salió, en qué orden y qué eligió) para poder re-puntuar.
 */
export const attemptStatus = pgEnum('attempt_status', [
  'in_progress',
  'submitted',
  'scored',
  'void',
]);
export const attemptPhase = pgEnum('attempt_phase', ['position', 'prep']);

export interface StoredRankingEntry {
  pos: string;
  pct: number;
  earned: number;
  maxp: number;
}

export const quizAttempt = pgTable(
  'quiz_attempt',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** Generado en el celular: un reenvío de la cola offline no crea otro intento. */
    clientAttemptId: uuid().notNull(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    teamId: uuid().references(() => team.id),
    questionnaireVersionId: uuid()
      .notNull()
      .references(() => questionnaireVersion.id),
    format: matchFormat().notNull(),
    status: attemptStatus().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    voidReason: text(),
  },
  (t) => [
    unique().on(t.userId, t.clientAttemptId),
    index().on(t.userId, t.submittedAt.desc()),
    index().on(t.teamId, t.status),
  ],
);

export const attemptItem = pgTable(
  'attempt_item',
  {
    attemptId: uuid()
      .notNull()
      .references(() => quizAttempt.id, { onDelete: 'cascade' }),
    phase: attemptPhase().notNull(),
    /** position_item o prep_item según `phase`. */
    itemId: uuid().notNull(),
    shownOrder: smallint().notNull(),
    optionOrder: uuid().array().notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.phase, t.itemId] })],
);

export const attemptAnswer = pgTable(
  'attempt_answer',
  {
    attemptId: uuid()
      .notNull()
      .references(() => quizAttempt.id, { onDelete: 'cascade' }),
    itemId: uuid().notNull(),
    optionId: uuid().notNull(),
    answeredAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.itemId] })],
);

export const attemptResult = pgTable(
  'attempt_result',
  {
    attemptId: uuid()
      .notNull()
      .references(() => quizAttempt.id, { onDelete: 'cascade' }),
    scoringVersion: text().notNull(),
    winner: positionCode().notNull(),
    ranking: jsonb().$type<StoredRankingEntry[]>().notNull(),
    /** Solo intentos v1 (histórico): desde v2 el test no tiene preparación. */
    prepScore: smallint(),
    prepTotal: smallint(),
    isOfficial: boolean().notNull(),
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.scoringVersion] })],
);
