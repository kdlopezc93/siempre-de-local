import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { positionCode } from '../../../shared/db/enums.js';

/**
 * Versiones del test de orientación (docs/03-modelo-datos.md §5). Una versión publicada
 * es inmutable: cambiar un peso o una pregunta es crear otra versión.
 */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

export const questionnaireStatus = pgEnum('questionnaire_status', [
  'draft',
  'published',
  'retired',
]);
export const positionItemContext = pgEnum('position_item_context', ['situation', 'attribute']);

export const questionnaireVersion = pgTable('questionnaire_version', {
  id: id(),
  label: text().notNull().unique(),
  status: questionnaireStatus().notNull().default('draft'),
  positionItemsPerAttempt: smallint().notNull().default(15),
  publishedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const positionItem = pgTable(
  'position_item',
  {
    id: id(),
    versionId: uuid()
      .notNull()
      .references(() => questionnaireVersion.id),
    code: text().notNull(),
    context: positionItemContext().notNull(),
    text: text().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [unique().on(t.versionId, t.code), unique().on(t.versionId, t.sort)],
);

export const positionOption = pgTable(
  'position_option',
  {
    id: id(),
    itemId: uuid()
      .notNull()
      .references(() => positionItem.id),
    label: text().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [unique().on(t.itemId, t.sort)],
);

export const optionWeight = pgTable(
  'option_weight',
  {
    optionId: uuid()
      .notNull()
      .references(() => positionOption.id),
    position: positionCode().notNull(),
    points: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.optionId, t.position] }),
    check('option_weight_points_positive', sql`${t.points} > 0`),
  ],
);

export const prepItem = pgTable(
  'prep_item',
  {
    id: id(),
    versionId: uuid()
      .notNull()
      .references(() => questionnaireVersion.id),
    position: positionCode().notNull(),
    text: text().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [unique().on(t.versionId, t.position, t.sort)],
);

export const prepOption = pgTable(
  'prep_option',
  {
    id: id(),
    itemId: uuid()
      .notNull()
      .references(() => prepItem.id),
    label: text().notNull(),
    /** Nunca sale del servidor (CLAUDE.md · Reglas de código). */
    isCorrect: boolean().notNull(),
    sort: smallint().notNull(),
  },
  (t) => [
    unique().on(t.itemId, t.sort),
    // Como mucho una correcta por ítem; "exactamente una" se valida al publicar.
    uniqueIndex('prep_option_one_correct')
      .on(t.itemId)
      .where(sql`${t.isCorrect}`),
  ],
);
