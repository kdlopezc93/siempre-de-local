import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
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
    /** Jugadores en la pizarra para el tipo `pitch_situation` (v2). */
    diagram: jsonb(),
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
