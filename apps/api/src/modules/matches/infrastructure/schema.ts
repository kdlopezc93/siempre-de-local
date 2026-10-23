import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index().on(t.teamId, t.startsAt)],
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
