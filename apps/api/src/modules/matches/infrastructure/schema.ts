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

import { matchFormat } from '../../../shared/db/enums.js';
import { user } from '../../identity/infrastructure/schema.js';
import { lineup } from '../../lineups/infrastructure/schema.js';
import { team } from '../../teams/infrastructure/schema.js';

export const matchStatus = pgEnum('match_status', ['scheduled', 'cancelled']);
export const matchReplyValue = pgEnum('match_reply_value', ['yes', 'no']);

/** Un partido convocado (Fase 7, `03` · team_match). */
export const teamMatch = pgTable(
  'team_match',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    teamId: uuid()
      .notNull()
      .references(() => team.id),
    createdBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    format: matchFormat().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    place: text().notNull(),
    opponent: text().notNull(),
    status: matchStatus().notNull().default('scheduled'),
    /** La alineación publicada para el equipo (PR 3 de la Fase 7). */
    lineupId: uuid().references(() => lineup.id, { onDelete: 'set null' }),
    publishedAt: timestamp({ withTimezone: true }),
    /** Después del partido (D18): el resultado y la figura, desde la hora del partido. */
    goalsFor: smallint(),
    goalsAgainst: smallint(),
    figurePlayerId: uuid().references(() => user.id, { onDelete: 'set null' }),
    resultAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.teamId, t.startsAt),
    check(
      'team_match_goals_range',
      sql`${t.goalsFor} between 0 and 99 and ${t.goalsAgainst} between 0 and 99`,
    ),
  ],
);

/** La respuesta de cada jugador: voy / no voy. Cambia hasta la hora del partido. */
export const matchReply = pgTable(
  'match_reply',
  {
    matchId: uuid()
      .notNull()
      .references(() => teamMatch.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    reply: matchReplyValue().notNull(),
    repliedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
);

/**
 * La evaluación de un jugador en un partido (D18): 1 Flojo a 5 Figura, una por jugador; quien
 * la corrige la reemplaza. La nota es del cuerpo técnico.
 */
export const matchRating = pgTable(
  'match_rating',
  {
    matchId: uuid()
      .notNull()
      .references(() => teamMatch.id, { onDelete: 'cascade' }),
    playerUserId: uuid()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    rating: smallint().notNull(),
    note: text(),
    ratedBy: uuid().references(() => user.id, { onDelete: 'set null' }),
    ratedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerUserId] }),
    index().on(t.playerUserId),
    check('match_rating_range', sql`${t.rating} between 1 and 5`),
  ],
);
