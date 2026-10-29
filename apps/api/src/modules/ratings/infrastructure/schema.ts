import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

/** Tarjeta del jugador (docs/03-modelo-datos.md §7). */
export const ratingAttributeGroup = pgEnum('rating_attribute_group', ['outfield', 'goalkeeper']);
export const ratingSource = pgEnum('rating_source', ['manual', 'field_test']);

/** Catálogo de atributos: lo siembra la migración desde `@sdl/domain`. */
export const ratingAttribute = pgTable('rating_attribute', {
  code: text().primaryKey(),
  nameEs: text().notNull(),
  group: ratingAttributeGroup().notNull(),
});

/** Una "foto" de la tarjeta: se agregan, nunca se editan (el histórico es la evolución). */
export const playerRating = pgTable(
  'player_rating',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** La escala es relativa a la categoría del equipo. */
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    playerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Null si se borró la cuenta de quien puntuó. */
    ratedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    ratedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    source: ratingSource().notNull().default('manual'),
    notes: text(),
    /**
     * La posición que quien puntuó le pone a la tarjeta, aunque su media más alta sea otra
     * (02 §7.4). Null en las fotos de antes: encabeza su mejor media.
     */
    position: positionCode(),
  },
  (t) => [index().on(t.teamId, t.playerUserId, t.ratedAt.desc())],
);

export const playerRatingValue = pgTable(
  'player_rating_value',
  {
    ratingId: uuid()
      .notNull()
      .references(() => playerRating.id, { onDelete: 'cascade' }),
    attributeCode: text()
      .notNull()
      .references(() => ratingAttribute.code),
    value: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ratingId, t.attributeCode] }),
    check('player_rating_value_range', sql`${t.value} between 0 and 99`),
  ],
);
