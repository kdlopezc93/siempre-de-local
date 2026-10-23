import type { ExamBoard } from '@sdl/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/** Bancos del examen de conocimiento (docs/03-modelo-datos.md §6). */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

export const certBankStatus = pgEnum('cert_bank_status', ['draft', 'published', 'retired']);
export const certItemKind = pgEnum('cert_item_kind', ['text', 'pitch_situation']);

/** Áreas de competencia de cada posición (marcaje, juego aéreo…). */
export const certArea = pgTable(
  'cert_area',
  {
    id: id(),
    position: positionCode().notNull(),
    code: text().notNull(),
    name: text().notNull(),
  },
  (t) => [unique().on(t.position, t.code)],
);

/** Una versión del banco de una posición. Publicada = inmutable. */
export const certBankVersion = pgTable(
  'cert_bank_version',
  {
    id: id(),
    position: positionCode().notNull(),
    label: text().notNull(),
    status: certBankStatus().notNull().default('draft'),
    itemsPerExam: smallint().notNull(),
    timeLimitS: integer().notNull(),
    attemptIntervalDays: integer().notNull(),
    minItemsToPublish: smallint().notNull(),
    /** `{ "1": 0.3, "2": 0.5, "3": 0.2 }` */
    difficultyMix: jsonb().$type<Record<'1' | '2' | '3', number>>().notNull(),
    /** Al retirarla por calidad, sus puntajes pasan a "a revisar" (02 §6.5). */
    retiredForQuality: boolean().notNull().default(false),
    /** Entrenador que revisó el contenido (D10) y cuándo. */
    reviewedBy: text().notNull(),
    reviewedOn: date().notNull(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.position, t.label),
    // Como mucho una publicada por posición.
    uniqueIndex('cert_bank_version_one_published')
      .on(t.position)
      .where(sql`${t.status} = 'published'`),
  ],
);

export const certItem = pgTable(
  'cert_item',
  {
    id: id(),
    bankVersionId: uuid()
      .notNull()
      .references(() => certBankVersion.id),
    /** Código estable dentro del banco (p. ej. DFC-AER-03): sirve para revisar y citar. */
    code: text().notNull(),
    areaId: uuid()
      .notNull()
      .references(() => certArea.id),
    difficulty: smallint().notNull(),
    kind: certItemKind().notNull().default('text'),
    text: text().notNull(),
    /** La jugada para el tipo `pitch_situation` (Fase 8), con un punto por opción si se toca. */
    diagram: jsonb().$type<ExamBoard>(),
    /** Nunca se envía al jugador durante el examen. */
    explanation: text().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [
    unique().on(t.bankVersionId, t.code),
    index().on(t.bankVersionId),
    check('cert_item_difficulty', sql`${t.difficulty} between 1 and 3`),
  ],
);

export const certOption = pgTable(
  'cert_option',
  {
    id: id(),
    itemId: uuid()
      .notNull()
      .references(() => certItem.id),
    label: text().notNull(),
    isCorrect: boolean().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [
    index().on(t.itemId),
    // Exactamente una correcta por ítem: la base impide dos; el lint, ninguna.
    uniqueIndex('cert_option_one_correct')
      .on(t.itemId)
      .where(sql`${t.isCorrect}`),
  ],
);

export const certExamStatus = pgEnum('cert_exam_status', ['in_progress', 'submitted', 'void']);
/** Cómo terminó: lo entregó, lo abandonó o se le acabó el tiempo (02 §6.3). */
export const certExamEnd = pgEnum('cert_exam_end', ['submit', 'abandon', 'timeout']);
export const knowledgeBand = pgEnum('knowledge_band', [
  'mastery',
  'solid',
  'developing',
  'insufficient',
]);

/** Un intento de examen (03 §6). El plazo lo fija el servidor al empezar. */
export const certExam = pgTable(
  'cert_exam',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Equipo desde el que se presentó (el puntaje es de la persona, no del equipo). */
    teamId: uuid().references(() => team.id),
    bankVersionId: uuid()
      .notNull()
      .references(() => certBankVersion.id),
    position: positionCode().notNull(),
    status: certExamStatus().notNull().default('in_progress'),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    deadlineAt: timestamp({ withTimezone: true }).notNull(),
    /** `startedAt + attemptIntervalDays`: un intento por posición cada N días. */
    nextAttemptAt: timestamp({ withTimezone: true }).notNull(),
    submittedAt: timestamp({ withTimezone: true }),
    endedBy: certExamEnd(),
    score: smallint(),
    total: smallint(),
    pct: numeric({ precision: 4, scale: 3, mode: 'number' }),
    band: knowledgeBand(),
    byArea: jsonb().$type<{ area: string; correct: number; total: number }[]>(),
    /** Puntaje "a revisar" (banco retirado por calidad, 02 §6.5). */
    underReview: boolean().notNull().default(false),
    /** Lo marca una re-evaluación completada: deja de contar (02 §6.7). */
    supersededAt: timestamp({ withTimezone: true }),
    /** Si se presentó para responder una re-evaluación. */
    reviewRequestId: uuid(),
    /** Anulación por el cuerpo técnico (02 §6.6): motivo obligatorio, visible al jugador. */
    voidReason: text(),
    voidedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    voidedAt: timestamp({ withTimezone: true }),
    /** Al anular, permite repetir sin esperar el mes. */
    voidResetsInterval: boolean().notNull().default(false),
  },
  (t) => [
    index().on(t.userId, t.position, t.startedAt.desc()),
    index().on(t.teamId),
    // Un examen activo por persona.
    uniqueIndex('cert_exam_one_in_progress')
      .on(t.userId)
      .where(sql`${t.status} = 'in_progress'`),
  ],
);

/** Las preguntas de un examen, en el orden en que se mostraron, con su respuesta. */
export const certExamItem = pgTable(
  'cert_exam_item',
  {
    examId: uuid()
      .notNull()
      .references(() => certExam.id, { onDelete: 'cascade' }),
    itemId: uuid()
      .notNull()
      .references(() => certItem.id),
    shownOrder: smallint().notNull(),
    /** Orden barajado de las opciones, tal como se mostraron. */
    optionOrder: uuid().array().notNull(),
    answerOptionId: uuid().references(() => certOption.id),
    answeredAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.examId, t.itemId] })],
);

export const certReviewStatus = pgEnum('cert_review_status', [
  'pending',
  'completed',
  'expired',
  'cancelled',
]);

/**
 * Re-evaluación pedida por el cuerpo técnico (02 §6.7). Vencida sigue abierta: el jugador
 * todavía puede presentarla, y mientras no lo haga ese puntaje cuenta 0 en el planificador.
 */
export const certReviewRequest = pgTable(
  'cert_review_request',
  {
    id: id(),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    playerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    position: positionCode().notNull(),
    requestedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    /** Obligatorio y visible para el jugador: no es un castigo sin explicación. */
    reason: text().notNull(),
    requestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp({ withTimezone: true }).notNull(),
    status: certReviewStatus().notNull().default('pending'),
    resolvedExamId: uuid().references(() => certExam.id),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index().on(t.teamId),
    // Una abierta (pendiente o vencida) por jugador y posición.
    uniqueIndex('cert_review_request_one_open')
      .on(t.playerUserId, t.position)
      .where(sql`${t.status} in ('pending', 'expired')`),
  ],
);
