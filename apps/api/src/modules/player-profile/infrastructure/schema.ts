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
  uuid,
} from 'drizzle-orm/pg-core';

import { positionCode } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';

/** Perfil propio del jugador (docs/03-modelo-datos.md §4). */
export const dominantFoot = pgEnum('dominant_foot', ['left', 'right', 'both']);

export const playerProfile = pgTable('player_profile', {
  userId: uuid()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text().notNull(),
  dominantFoot: dominantFoot(),
  playsGoalkeeper: boolean().notNull().default(false),
  /** Su foto en el almacenamiento de fotos (ADR-09), o null. La sube él; es opcional. */
  photoKey: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const playerPreferredPosition = pgTable(
  'player_preferred_position',
  {
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    position: positionCode().notNull(),
    rank: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.position] }),
    unique().on(t.userId, t.rank),
    check('player_preferred_position_rank', sql`${t.rank} between 1 and 3`),
  ],
);
